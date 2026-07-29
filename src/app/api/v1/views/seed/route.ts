import { NextResponse } from "next/server";
import { seedViewsMove, seededMove } from "@/lib/views-seed";

/**
 * The Views page's own move, so a reviewer arriving from a link is not sent away.
 *
 * `GET` reports whether it exists. `POST` creates it if it does not, and is
 * idempotent — pressing the button twice returns the same move rather than a
 * second one, and never resets a projection someone is reading.
 *
 * Takes no input at all. Not an organisation, not an actor, not a payload. The
 * only thing a caller can express is "seed the one synthetic move this page is
 * about", which is what keeps a public write path from being a public write
 * path into anything that matters.
 *
 * Scoped to `views-demo`. Deliberately not `uc-demo`: that tenant belongs to the
 * console, whose reset deletes the organisation outright, so seeding from here
 * would destroy the state of whoever had `/demo` open.
 */
export async function GET() {
  const move = await seededMove();
  return NextResponse.json(move ? { exists: true, ...move } : { exists: false });
}

export async function POST() {
  try {
    const result = await seedViewsMove();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
