import { NextResponse } from "next/server";
import { checkSystemReadiness } from "@/server/readiness/readiness-service";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET() {
  try {
    const report = await checkSystemReadiness(process.env);
    const statusCode = report.overall === "ready" ? 200 : 503;

    return NextResponse.json(
      {
        status: report.status,
        overall: report.overall,
      },
      {
        status: statusCode,
        headers: noStoreHeaders,
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "not_ready",
        overall: "blocked",
      },
      {
        status: 503,
        headers: noStoreHeaders,
      },
    );
  }
}
