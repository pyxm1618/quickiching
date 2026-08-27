import { NextResponse } from "next/server";
import { checkSystemReadiness } from "@/server/readiness/readiness-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await checkSystemReadiness(process.env);
    const statusCode = report.overall === "ready" ? 200 : 503;

    return NextResponse.json(report, {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: "not_ready",
        overall: "blocked",
        error: "INTERNAL_READINESS_CHECK_FAILED",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
