import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { join } from "node:path";

/**
 * Writes a still rendered from the residence into `public/`.
 *
 * Same reasoning as the GI bake route: the image can only be produced where the
 * scene actually exists, which is a live renderer, so this is how it reaches
 * disk to be committed and served as a static asset rather than re-rendered in
 * every visitor's browser.
 *
 * Development only, and it accepts nothing but a PNG data URL under a name it
 * sanitises itself — an unauthenticated POST that writes a file needs both.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json()) as { data?: string; name?: string };
  const prefix = "data:image/png;base64,";
  if (!body?.data?.startsWith(prefix)) {
    return NextResponse.json({ error: "expected a PNG data URL" }, { status: 400 });
  }

  // Never trust the name for a path — strip it to a bare slug.
  const name = (body.name ?? "capture").replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "capture";
  const bytes = Buffer.from(body.data.slice(prefix.length), "base64");

  const dir = join(process.cwd(), "public", "renders");
  await mkdir(dir, { recursive: true });

  /*
    Written as WebP, not as the PNG the canvas hands over.

    A 3000x1687 canvas serialises to roughly 4MB of PNG, and these renders are
    only ever consumed through `next/image`, which re-encodes them anyway — so
    the PNG bought nothing and cost every reviewer 4MB per frame at clone time.
    At quality 92 the same frame is around 200KB and visually identical on
    flat-shaded architectural geometry.

    It also keeps this route honest with the directory it writes into: the
    pages reference `.webp`, so a capture that still produced `.png` would land
    a file nothing pointed at and quietly do nothing.
  */
  const webp = await sharp(bytes).webp({ quality: 92 }).toBuffer();
  await writeFile(join(dir, `${name}.webp`), webp);

  return NextResponse.json({
    ok: true,
    file: `/renders/${name}.webp`,
    bytes: webp.length,
    from: `${(bytes.length / 1048576).toFixed(1)}MB png`,
  });
}
