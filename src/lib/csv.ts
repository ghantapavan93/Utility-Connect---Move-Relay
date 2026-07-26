/**
 * CSV parsing and row mapping.
 *
 * `csv_upload` has been a first-class channel in this system since the
 * beginning — it has a versioned contract, its own trust tier (the lowest, at
 * 0.5, below the partner API and well below a customer confirming their own
 * details), and it is one of the three sources in the demo narrative. It also
 * had no ingestion path whatsoever. There was no file input, no parser, and no
 * endpoint; the "CSV" in the demo was a JSON object with a label on it.
 *
 * That gap mattered more than a missing feature, because the CSV is the channel
 * the whole trust model is *about*. A spreadsheet exported by a brokerage, hand
 * edited, re-uploaded twice, with one digit wrong in a phone number, is the
 * realistic origin of the duplicate this system exists to resolve.
 *
 * No dependency for this. A CSV parser that handles quoting is about fifty
 * lines, and the alternative is adding a library to the bundle for one route.
 */

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export interface CsvRowError {
  /** 1-based, counting the header as line 1 — what a spreadsheet shows. */
  line: number;
  reason: string;
}

/**
 * Splits CSV text into headers and row objects.
 *
 * Handles the parts that actually appear in exported spreadsheets: quoted
 * fields, commas inside quotes, escaped quotes (`""`), CRLF line endings, and a
 * trailing newline. Deliberately does not handle multi-line quoted fields —
 * that is rare in this domain, and silently mis-parsing is worse than refusing.
 */
export function parseCsv(text: string): ParsedCsv {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]!);
    const row: Record<string, string> = {};
    headers.forEach((h, n) => {
      row[h] = (cells[n] ?? "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/** One line into cells, respecting quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cell);
      cell = "";
    } else {
      cell += c;
    }
  }
  out.push(cell);
  return out;
}

/**
 * The column names a brokerage export is expected to carry.
 *
 * Several aliases per field, because the whole point of this channel is that
 * nobody controls the producer. A spreadsheet says "Move Date" or "move_date"
 * or "Movein" depending on who saved it, and rejecting a file over a header
 * name is the kind of strictness that pushes people back to email.
 */
const COLUMNS: Record<string, string[]> = {
  first_name: ["first_name", "firstname", "first", "given_name"],
  last_name: ["last_name", "lastname", "last", "surname", "family_name"],
  email: ["email", "email_address", "e-mail"],
  phone: ["phone", "phone_number", "mobile", "telephone"],
  move_date: ["move_date", "movedate", "move date", "date", "movein", "move_in_date"],
  to_address: ["to_address", "address", "new_address", "destination", "service_address"],
  services: ["services", "service", "requested_services"],
  partner_slug: ["partner_slug", "partner", "brokerage", "source"],
};

const pick = (row: Record<string, string>, field: string): string | undefined => {
  for (const alias of COLUMNS[field] ?? []) {
    const v = row[alias];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
};

export interface MappedRow {
  line: number;
  payload: Record<string, unknown>;
}

export interface MapResult {
  mapped: MappedRow[];
  /** Rows that could not be shaped at all — never silently dropped. */
  rejected: CsvRowError[];
}

/**
 * Maps parsed rows onto the `csv_upload` contract shape.
 *
 * This deliberately stops at *shape*. It does not validate the contract — that
 * happens in `ingestReferral`, where a failure is quarantined with its reasons
 * rather than thrown away, which is the behaviour the whole channel is designed
 * around. The only rows rejected here are ones with nothing to identify a
 * person by, because a referral with no name and no email is not a referral.
 */
export function mapRows(parsed: ParsedCsv): MapResult {
  const mapped: MappedRow[] = [];
  const rejected: CsvRowError[] = [];

  parsed.rows.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const first = pick(row, "first_name");
    const last = pick(row, "last_name");
    const email = pick(row, "email");

    if (!first && !last && !email) {
      rejected.push({ line, reason: "no name and no email — nothing identifies a person" });
      return;
    }

    const servicesRaw = pick(row, "services");
    const payload: Record<string, unknown> = {
      customer: {
        first_name: first ?? "",
        last_name: last ?? "",
        email: email ?? "",
        phone: pick(row, "phone"),
      },
      move: {
        date: normaliseDate(pick(row, "move_date")),
        to_address: pick(row, "to_address") ?? "",
      },
    };

    if (servicesRaw) {
      payload.services = servicesRaw
        .split(/[;|]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
    const partner = pick(row, "partner_slug");
    if (partner) payload.referral = { partner_slug: partner };

    mapped.push({ line, payload });
  });

  return { mapped, rejected };
}

/**
 * Normalises the date formats a spreadsheet actually produces.
 *
 * Returns the input untouched when it does not match a known shape, so the
 * contract validator refuses it and the row quarantines with a readable reason
 * — rather than this function guessing and writing a plausible wrong date into
 * a canonical record. A wrong move date is worse than a rejected one.
 */
function normaliseDate(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();

  // Already ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // US-style M/D/YYYY, which is what a US brokerage export overwhelmingly is.
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }

  return trimmed;
}
