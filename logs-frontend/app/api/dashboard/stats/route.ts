import { NextResponse } from "next/server";
import { collectContainerStats } from "@/lib/docker/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await collectContainerStats();
    return NextResponse.json({ containers: stats, timestamp: Date.now() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
