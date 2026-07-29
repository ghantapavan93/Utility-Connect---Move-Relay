/**
 * The synthetic partner batch, and the tokens the console draws for it.
 *
 * Lived inside `CsvDrop` as a template literal, which was fine while one
 * component used it. The control room shows the rows *before* they are
 * submitted — so a reviewer can see what is about to enter and then watch where
 * each one lands — and two components deriving the same five rows from two
 * copies of the same string is how a preview and a result quietly stop
 * agreeing.
 *
 * Row five carries `marco.silva.example.com`. The missing `@` is the whole
 * point: a batch where everything succeeded would demonstrate nothing about
 * what happens when a partner's data is wrong.
 */

export const SAMPLE_BATCH_CSV = `first_name,last_name,email,mobile,move_date,address,services,brokerage
Priya,Raman,priya.raman@example.com,469-555-0114,2026-09-18,88 Bishop Ave Apt 4B Dallas TX 75208,electric;internet,north-texas-realty
Tomas,Herrera,tomas.herrera@example.com,972-555-0166,2026-09-21,415 Comal St Richardson TX 75080,electric,north-texas-realty
Aisha,Bello,aisha.bello@example.com,214-555-0190,2026-10-02,2200 Live Oak St Unit 12 Dallas TX 75204,electric;internet;security,north-texas-realty
Wen,Zhao,wen.zhao@example.com,469-555-0177,10/05/2026,7 Legacy Dr Frisco TX 75034,internet,north-texas-realty
Marco,Silva,marco.silva.example.com,214-555-0155,2026-10-09,930 Cedar Springs Rd Dallas TX 75219,electric,north-texas-realty
`;

export const SAMPLE_BATCH_FILENAME = "north-texas-realty-batch.csv";

export interface BatchToken {
  /** 1-based, matching the `line` the upload endpoint returns. */
  line: number;
  /** Enough to recognise the row. Never the full record. */
  label: string;
  services: string[];
}

/**
 * The rows, reduced to what a reviewer needs to follow them.
 *
 * A first name and the services asked for. Not the address, not the phone, not
 * the email — the preview exists to make five tokens distinguishable, and
 * printing a full synthetic identity on screen to achieve that would set the
 * wrong habit on a page about data handling.
 */
export function sampleTokens(): BatchToken[] {
  const [, ...rows] = SAMPLE_BATCH_CSV.trim().split("\n");
  return rows.map((row, i) => {
    const cells = row.split(",");
    return {
      line: i + 1,
      label: `${cells[0] ?? "row"} ${(cells[1] ?? "").slice(0, 1)}.`,
      services: (cells[6] ?? "").split(";").filter(Boolean),
    };
  });
}

/**
 * The stages the upload genuinely performs, in order.
 *
 * Each maps to real work in `POST /api/v1/upload/csv`: the parse and contract
 * check, `ingestReferral`'s duplicate assessment, canonical field writing,
 * persistence, and the per-row classification returned in `results`. Nothing
 * here is a stage invented to make a progress bar longer — a visualisation that
 * animated a step the backend does not perform would be the same fabrication
 * this project spends its time arguing against.
 */
export const BATCH_STAGES = [
  { key: "contract", label: "Contract validation", detail: "Each row checked against the csv_upload contract." },
  { key: "identity", label: "Identity handling", detail: "Duplicate and near-match assessment against existing moves." },
  { key: "canonical", label: "Canonicalization", detail: "Values written as field versions with channel and trust tier." },
  { key: "persist", label: "Persistence", detail: "Committed inside one transaction per row." },
  { key: "classify", label: "Result classification", detail: "Each row returned as accepted, replayed, quarantined or unmappable." },
] as const;
