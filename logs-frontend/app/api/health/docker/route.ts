import { NextResponse } from "next/server";
import { pingDocker } from "@/lib/docker/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await pingDocker();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
