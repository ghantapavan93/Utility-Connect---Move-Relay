import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Persists a GI bake produced in the browser.
 *
 * The bake has to run where the scene is — the residence is React geometry, so
 * the only place the real thing exists is a live renderer. This route is how
 * that result gets onto disk so it can be committed and shipped as a static
 * asset, instead of being recomputed in every visitor's browser.
 *
 * Development only. In production it 404s, because a route that writes a file
 * from an unauthenticated POST body is a hole, however small the file.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json()) as { surfaces?: Record<string, number[]>; stats?: unknown };
  if (!body?.surfaces || typeof body.surfaces !== "object") {
    return NextResponse.json({ error: "expected { surfaces }" }, { status: 400 });
  }

  // Round to four decimals. Irradiance values are small and smooth, and the
  // difference between 4 and 17 significant figures here is roughly 3x the
  // file size for no visible change.
  const surfaces: Record<string, number[]> = {};
  for (const [name, values] of Object.entries(body.surfaces)) {
    surfaces[name] = (values as number[]).map((v) => Math.round(v * 1e4) / 1e4);
  }

  const dir = join(process.cwd(), "src", "generated");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "gi-bake.json");
  await writeFile(file, JSON.stringify({ stats: body.stats, surfaces }), "utf8");

  return NextResponse.json({
    ok: true,
    file: "src/generated/gi-bake.json",
    surfaces: Object.keys(surfaces).length,
    values: Object.values(surfaces).reduce((n, v) => n + v.length, 0),
  });
}
