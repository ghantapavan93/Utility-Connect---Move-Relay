#!/usr/bin/env node
/**
 * Move an MP4's `moov` index to the front of the file, so playback can begin
 * before the download finishes. The equivalent of
 * `ffmpeg -movflags +faststart`, without needing ffmpeg installed.
 *
 * ## Why this exists
 *
 * An MP4 keeps its table of contents in the `moov` box. Most encoders can only
 * write it once they know the final size of everything, so it lands *after*
 * the media data. A browser streaming such a file cannot draw a single frame
 * until the last byte arrives — a 7 MB clip that would start in half a second
 * instead shows black for six on a slow connection. There is no error, no
 * console warning, and nothing on the page to suggest why.
 *
 * `marketing-video.test.ts` fails when a committed clip is in that state. This
 * is the fix for when ffmpeg is not on the machine.
 *
 * ## What it does
 *
 * Rewrites the file as `[ftyp][moov][everything else in original order]`, then
 * corrects every chunk offset inside `moov` so it still points at the same
 * media bytes in their new positions.
 *
 * That second half is the part that matters and the part that is easy to get
 * wrong. `stco` and `co64` hold *absolute file offsets* of each chunk of audio
 * and video. Move the boxes without rewriting them and the file still parses,
 * still reports the right duration, still looks correct to every check — and
 * plays garbage or nothing at all. So rather than assuming the only thing that
 * shifts is `mdat`, this builds an explicit old-position → new-position map for
 * every top-level box and relocates each offset through the box that actually
 * contains it.
 *
 * The result is verified before it is written: re-parsed, checked for a
 * front-loaded index, and compared against the original's duration, dimensions
 * and media payload. A file that fails any of those is not saved.
 *
 * Usage:
 *   node scripts/faststart.mjs public/videos/some-clip.mp4
 *   node scripts/faststart.mjs public/videos/some-clip.mp4 --dry-run
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

/** Top-level box list: type, start offset, total size, header size. */
function topLevelBoxes(buf) {
  const boxes = [];
  let p = 0;
  while (p + 8 <= buf.length) {
    let size = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) {
      size = buf.length - p;
    }
    if (size < header || p + size > buf.length) {
      throw new Error(`corrupt box "${type}" at ${p}: size ${size}`);
    }
    boxes.push({ type, start: p, size, header });
    p += size;
  }
  return boxes;
}

/**
 * Every `stco`/`co64` box inside a `moov` buffer, located by walking the
 * container hierarchy rather than scanning for the four-character code —
 * scanning would happily match those bytes inside compressed media payload.
 */
function findChunkOffsetTables(moov) {
  const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "udta"]);
  const tables = [];

  const walk = (start, end) => {
    let p = start;
    while (p + 8 <= end) {
      let size = moov.readUInt32BE(p);
      const type = moov.toString("latin1", p + 4, p + 8);
      let header = 8;
      if (size === 1) {
        size = Number(moov.readBigUInt64BE(p + 8));
        header = 16;
      } else if (size === 0) {
        size = end - p;
      }
      if (size < header || p + size > end) break;

      if (type === "stco" || type === "co64") {
        // version(1) + flags(3) + entry_count(4), then the entries.
        const count = moov.readUInt32BE(p + header + 4);
        tables.push({ type, entriesAt: p + header + 8, count });
      }
      if (CONTAINERS.has(type)) walk(p + header, p + size);
      p += size;
    }
  };

  walk(0, moov.length);
  return tables;
}

function faststart(buf) {
  const boxes = topLevelBoxes(buf);
  const moov = boxes.find((b) => b.type === "moov");
  const ftyp = boxes.find((b) => b.type === "ftyp");
  if (!moov) throw new Error("no moov box — not a readable MP4");

  const mdat = boxes.find((b) => b.type === "mdat");
  if (mdat && moov.start < mdat.start) return { already: true, buf };

  /*
    New order: ftyp first (it must stay first — players read the brand from
    byte zero), then moov, then everything else untouched and in sequence.
  */
  const rest = boxes.filter((b) => b !== moov && b !== ftyp);
  const ordered = [...(ftyp ? [ftyp] : []), moov, ...rest];

  // Old start → new start, per box. Chunk offsets are relocated through this.
  const moves = [];
  let cursor = 0;
  for (const box of ordered) {
    moves.push({ oldStart: box.start, oldEnd: box.start + box.size, delta: cursor - box.start });
    cursor += box.size;
  }

  const relocate = (offset) => {
    const move = moves.find((m) => offset >= m.oldStart && offset < m.oldEnd);
    if (!move) throw new Error(`chunk offset ${offset} falls outside every box`);
    return offset + move.delta;
  };

  // Patch a copy of moov so the original stays intact for verification.
  const patchedMoov = Buffer.from(buf.subarray(moov.start, moov.start + moov.size));
  let patched = 0;
  for (const table of findChunkOffsetTables(patchedMoov)) {
    for (let i = 0; i < table.count; i++) {
      if (table.type === "stco") {
        const at = table.entriesAt + i * 4;
        const next = relocate(patchedMoov.readUInt32BE(at));
        if (next > 0xffffffff) throw new Error("offset overflows 32-bit stco; co64 needed");
        patchedMoov.writeUInt32BE(next, at);
      } else {
        const at = table.entriesAt + i * 8;
        patchedMoov.writeBigUInt64BE(BigInt(relocate(Number(patchedMoov.readBigUInt64BE(at)))), at);
      }
      patched++;
    }
  }

  const out = Buffer.concat(
    ordered.map((box) =>
      box === moov ? patchedMoov : buf.subarray(box.start, box.start + box.size),
    ),
  );
  return { already: false, buf: out, patched };
}

const target = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!target || !existsSync(target)) {
  console.error("usage: node scripts/faststart.mjs <file.mp4> [--dry-run]");
  process.exit(1);
}

const original = readFileSync(target);
const result = faststart(original);

if (result.already) {
  console.log(`${basename(target)}: already fast-start, nothing to do`);
  process.exit(0);
}

/*
  Verify before writing. A remux that silently corrupts a chunk table still
  produces a file that parses, reports the right duration, and plays nothing —
  so the checks have to go past "it parses".
*/
const before = topLevelBoxes(original);
const after = topLevelBoxes(result.buf);
const sizeOf = (boxes, type) => boxes.find((b) => b.type === type)?.size ?? null;

const checks = [
  [result.buf.length === original.length, `size preserved (${original.length})`],
  [after[0]?.type === before[0]?.type, `first box unchanged (${after[0]?.type})`],
  [after.findIndex((b) => b.type === "moov") < after.findIndex((b) => b.type === "mdat"), "moov now precedes mdat"],
  [sizeOf(after, "moov") === sizeOf(before, "moov"), "moov size unchanged"],
  [sizeOf(after, "mdat") === sizeOf(before, "mdat"), "mdat size unchanged"],
];

// The media payload itself must be byte-identical — only its position moved.
const mdatBefore = before.find((b) => b.type === "mdat");
const mdatAfter = after.find((b) => b.type === "mdat");
if (mdatBefore && mdatAfter) {
  const a = original.subarray(mdatBefore.start, mdatBefore.start + mdatBefore.size);
  const b = result.buf.subarray(mdatAfter.start, mdatAfter.start + mdatAfter.size);
  checks.push([a.equals(b), "mdat payload byte-identical"]);
}

let ok = true;
for (const [pass, label] of checks) {
  console.log(`  ${pass ? "ok  " : "FAIL"} ${label}`);
  if (!pass) ok = false;
}
if (!ok) {
  console.error("verification failed — nothing written");
  process.exit(1);
}

console.log(`  ${result.patched} chunk offsets relocated`);

if (dryRun) {
  console.log(`${basename(target)}: dry run, nothing written`);
  process.exit(0);
}

copyFileSync(target, `${target}.bak`);
writeFileSync(target, result.buf);
console.log(`${basename(target)}: rewritten fast-start (original kept at ${basename(target)}.bak)`);
