/**
 * Just enough MP4 to tell whether a committed clip will actually play well.
 *
 * This exists because two of the properties that decide whether a video is
 * usable on a web page are invisible to every other check in this repository.
 * A file can be the right length, the right size, correctly encoded, pass
 * typecheck, pass the build — and still make a visitor stare at a black
 * rectangle for six seconds. `tsc` does not open MP4s, and neither does the
 * test suite unless something does the reading.
 *
 * Two facts are worth extracting:
 *
 * **Duration**, because a marketing clip that runs past about twelve seconds
 * has stopped being a clip and become something the visitor has to decide
 * whether to sit through.
 *
 * **Fast-start**, which is the one that actually bites. An MP4's `moov` atom
 * holds the index; without it the player knows nothing about the stream. If
 * `moov` sits *after* `mdat` — the default for most encoders — playback cannot
 * begin until the entire file has downloaded. A 7 MB clip that would otherwise
 * start in half a second instead starts in six on a slow connection, and there
 * is no error, no console warning, and nothing on the page to suggest why.
 * `ffmpeg -movflags +faststart` moves the index to the front and costs
 * nothing; the point of reading it here is that forgetting the flag becomes a
 * failing test rather than a bad first impression.
 *
 * This is a box walker, not a demuxer. It reads the container's table of
 * contents and stops.
 */

export interface Mp4Meta {
  /** Duration in seconds, or null if no movie header was found. */
  seconds: number | null;
  /** Largest track dimensions found, or null. */
  width: number | null;
  height: number | null;
  /** True when `moov` precedes `mdat`, so playback can start before download finishes. */
  faststart: boolean;
}

/** Container boxes worth descending into; everything else is skipped whole. */
const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts"]);

export function readMp4Meta(buf: Buffer): Mp4Meta {
  const meta: Mp4Meta = { seconds: null, width: null, height: null, faststart: false };
  let timescale = 0;
  let duration = 0;
  let moovOffset = -1;
  let mdatOffset = -1;

  const walk = (start: number, end: number) => {
    let p = start;
    while (p + 8 <= end) {
      let size = buf.readUInt32BE(p);
      const type = buf.toString("latin1", p + 4, p + 8);
      let header = 8;

      // Size 1 means a 64-bit length follows the type; size 0 means "to the end".
      if (size === 1) {
        if (p + 16 > end) break;
        size = Number(buf.readBigUInt64BE(p + 8));
        header = 16;
      } else if (size === 0) {
        size = end - p;
      }
      // A box smaller than its own header is corrupt; stop rather than loop forever.
      if (size < header || p + size > end) break;

      if (type === "moov" && moovOffset === -1) moovOffset = p;
      if (type === "mdat" && mdatOffset === -1) mdatOffset = p;

      if (type === "mvhd") {
        const version = buf[p + header];
        const base = p + header + 4; // skip version+flags
        if (version === 1) {
          timescale = buf.readUInt32BE(base + 16);
          duration = Number(buf.readBigUInt64BE(base + 20));
        } else {
          timescale = buf.readUInt32BE(base + 8);
          duration = buf.readUInt32BE(base + 12);
        }
      }

      if (type === "tkhd") {
        // Width and height are the last eight bytes of the box, 16.16 fixed point.
        const w = Math.round(buf.readUInt32BE(p + size - 8) / 65536);
        const h = Math.round(buf.readUInt32BE(p + size - 4) / 65536);
        // Audio tracks report 0x0; only video tracks carry dimensions.
        if (w > 0 && h > 0 && w > (meta.width ?? 0)) {
          meta.width = w;
          meta.height = h;
        }
      }

      if (CONTAINERS.has(type)) walk(p + header, p + size);
      p += size;
    }
  };

  walk(0, buf.length);

  if (timescale > 0) meta.seconds = duration / timescale;
  meta.faststart = moovOffset !== -1 && (mdatOffset === -1 || moovOffset < mdatOffset);
  return meta;
}
