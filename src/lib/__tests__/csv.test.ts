import { describe, it, expect, beforeAll } from "vitest";
import { parseCsv, mapRows } from "../csv";
import { reset } from "../demo-orchestrator";
import { query } from "../db";
import { demoConstants } from "../demo-orchestrator";
import { POST } from "../../app/api/v1/upload/csv/route";

/**
 * CSV upload.
 *
 * An audit classified this channel NOT STARTED. `csv_upload` had a versioned
 * contract and the lowest trust tier in the system since the beginning, and no
 * way to upload a CSV — the "CSV" in the demo was a JSON object with a label on
 * it, while the Failure Theater card said "upload the same CSV twice".
 *
 * That gap mattered because the spreadsheet is the channel the trust model is
 * *about*: exported by a brokerage, hand-edited, sent twice, one digit wrong in
 * a phone number. It is the realistic origin of the duplicate this whole system
 * exists to resolve.
 */

describe("parsing the CSV a spreadsheet actually produces", () => {
  it("handles quoted fields containing commas", () => {
    const { headers, rows } = parseCsv(
      'first_name,last_name,address\nMaya,Patel,"1420 Windhaven Pkwy, Plano, TX"\n',
    );
    expect(headers).toEqual(["first_name", "last_name", "address"]);
    expect(rows[0]!.address).toBe("1420 Windhaven Pkwy, Plano, TX");
  });

  it("handles escaped quotes and CRLF line endings", () => {
    const { rows } = parseCsv('name,note\r\nMaya,"she said ""yes"""\r\n');
    expect(rows[0]!.note).toBe('she said "yes"');
  });

  it("lowercases headers so column casing never decides an outcome", () => {
    const { headers } = parseCsv("First_Name,MOVE DATE\nMaya,2026-08-14");
    expect(headers).toEqual(["first_name", "move date"]);
  });

  it("returns nothing rather than guessing at an empty file", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("\n\n").headers).toEqual([]);
  });
});

describe("mapping rows onto the contract", () => {
  it("accepts the column aliases different exports use", () => {
    // Nobody controls the producer here. Rejecting a file over a header name is
    // the kind of strictness that pushes a partner back to email.
    const { mapped } = mapRows(parseCsv("firstname,surname,e-mail,movedate,destination\nMaya,Patel,m@x.com,2026-08-14,1420 Windhaven"));
    const payload = mapped[0]!.payload as Record<string, Record<string, unknown>>;
    expect(payload.customer!.first_name).toBe("Maya");
    expect(payload.customer!.last_name).toBe("Patel");
    expect(payload.move!.date).toBe("2026-08-14");
  });

  it("normalises US date format to ISO", () => {
    const { mapped } = mapRows(parseCsv("first_name,email,move_date\nMaya,m@x.com,8/14/2026"));
    expect((mapped[0]!.payload as Record<string, Record<string, unknown>>).move!.date).toBe("2026-08-14");
  });

  it("leaves an unrecognised date untouched so the contract refuses it", () => {
    // Deliberately not clever. A wrong move date written confidently into a
    // canonical record is worse than a row that quarantines with a reason.
    const { mapped } = mapRows(parseCsv("first_name,email,move_date\nMaya,m@x.com,next Tuesday"));
    expect((mapped[0]!.payload as Record<string, Record<string, unknown>>).move!.date).toBe("next Tuesday");
  });

  it("splits a multi-service cell", () => {
    const { mapped } = mapRows(parseCsv("first_name,email,services\nMaya,m@x.com,Electric;Internet"));
    expect((mapped[0]!.payload as Record<string, unknown>).services).toEqual(["electric", "internet"]);
  });

  it("reports an unidentifiable row by line number instead of dropping it", () => {
    const { mapped, rejected } = mapRows(parseCsv("first_name,email,phone\nMaya,m@x.com,1\n,,555"));
    expect(mapped).toHaveLength(1);
    expect(rejected[0]!.line).toBe(3); // header is line 1
    expect(rejected[0]!.reason).toMatch(/nothing identifies a person/);
  });
});

describe("the upload endpoint", () => {
  const CSV =
    "first_name,last_name,email,phone,move_date,to_address,services\n" +
    "Maya,Patel,maya.patel@example.com,469-555-0143,2026-08-14,\"1420 Windhaven Pkwy, Plano, TX 75093\",electric\n" +
    "Dev,Shah,dev.shah@example.com,469-555-0180,8/20/2026,\"88 Legacy Dr, Frisco, TX\",electric;internet\n";

  const upload = (body: string, name = "referrals.csv", actor = "user:concierge-7") => {
    const form = new FormData();
    form.append("file", new File([body], name, { type: "text/csv" }));
    return POST(
      new Request("http://localhost/api/v1/upload/csv", {
        method: "POST",
        body: form,
        headers: actor ? { "x-actor": actor } : {},
      }),
    );
  };

  beforeAll(async () => {
    await reset();
  });

  it("refuses an upload with no actor", async () => {
    const form = new FormData();
    form.append("file", new File([CSV], "x.csv"));
    const res = await POST(
      new Request("http://localhost/api/v1/upload/csv", { method: "POST", body: form }),
    );
    expect(res.status).toBe(401);
  });

  it("ingests each row through the same pipeline as every other channel", async () => {
    const res = await upload(CSV);
    const body = (await res.json()) as {
      rows: { total: number; accepted: number; quarantined: number };
      correlationId: string;
    };
    expect(body.rows.total).toBe(2);
    expect(body.rows.accepted).toBe(2);

    // Rows land as raw_submissions on the csv_upload channel — not through a
    // side door that skips contract validation and provenance.
    const org = (
      await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
        demoConstants.ORG_SLUG,
      ])
    )[0]!;
    const stored = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM raw_submissions
        WHERE organization_id = $1 AND channel = 'csv_upload' AND correlation_id = $2`,
      [org.id, body.correlationId],
    );
    expect(Number(stored[0]!.n)).toBe(2);
  });

  it("replays rather than duplicating when the same file is uploaded twice", async () => {
    // The claim Failure Theater has always made and could not previously
    // demonstrate. The batch id is a hash of the file's bytes, so identical
    // content produces identical idempotency keys — a random id per request
    // would have created a second set of referrals here.
    await reset();
    const first = (await (await upload(CSV)).json()) as { rows: { accepted: number } };
    expect(first.rows.accepted).toBe(2);

    const second = (await (await upload(CSV)).json()) as {
      rows: { accepted: number; replayed: number };
    };
    expect(second.rows.replayed).toBe(2);
    expect(second.rows.accepted).toBe(0);
  });

  it("quarantines a bad row with reasons and still lands the good ones", async () => {
    await reset();
    // The good row carries every field the contract requires — phone included,
    // which the first draft of this fixture omitted, so both rows quarantined
    // and the test failed for exactly the right reason.
    const mixed = [
      "first_name,last_name,email,phone,move_date,to_address",
      "Maya,Patel,maya.patel@example.com,469-555-0143,2026-08-14,1420 Windhaven Pkwy",
      "Broken,Row,not-an-email,469-555-0199,next Tuesday,",
      "",
    ].join("\n");

    const body = (await (await upload(mixed, "mixed.csv")).json()) as {
      rows: { accepted: number; quarantined: number };
      results: Array<{ line: number; status: string; issues?: Array<{ message: string }> }>;
    };

    // Partial landing is the behaviour that makes schema drift survivable — a
    // whole file rejected for one bad line is how integrations get abandoned.
    expect(body.rows.accepted).toBe(1);
    expect(body.rows.quarantined).toBe(1);

    const bad = body.results.find((r) => r.status === "quarantined")!;
    expect(bad.line).toBe(3);
    expect(bad.issues?.length ?? 0).toBeGreaterThan(0);
  });

  it("rejects a file with no rows rather than reporting a successful no-op", async () => {
    const res = await upload("");
    expect(res.status).toBe(400);
  });
});
