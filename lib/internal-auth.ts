import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Validates that a request comes from an internal caller (cron, server-to-server).
 * Callers must pass `Authorization: Bearer <INTERNAL_API_SECRET>`.
 * Returns a 401 NextResponse if invalid, or null if the request is authorised.
 */
export function requireInternalSecret(
  req: NextRequest,
): NextResponse | null {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    console.error("INTERNAL_API_SECRET is not configured");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
