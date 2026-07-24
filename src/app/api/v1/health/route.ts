import { NextResponse } from "next/server";
import { query, dbBackend } from "@/lib/db";

/**
 * GET /api/v1/health
 *
 * Liveness plus a real readiness probe: the database check runs an actual query
 * against the actual backend, so a broken DATABASE_URL fails here rather than on
 * a customer's first click. This is the endpoint a load balancer, a deploy
 * pipeline's smoke test, and an uptime monitor all call.
 */
export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { ok: boolean; latency_ms?: number; error?: string }> = {};

  try {
    const t = Date.now();
    await query("SELECT 1");
    checks.database = { ok: true, latency_ms: Date.now() - t };
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }

  const healthy = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      backend: dbBackend,
      uptime_s: Math.round(process.uptime()),
      checks,
      response_ms: Date.now() - startedAt,
    },
    { status: healthy ? 200 : 503 },
  );
}
