import { NextResponse } from "next/server";
import { checkSystemReadiness, type SystemReadinessReport } from "@/server/readiness/readiness-service";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

const READINESS_CACHE_TTL_MS = 20_000;
let readinessCache: { expiresAt: number; report: SystemReadinessReport } | undefined;

async function getReadinessReport(): Promise<SystemReadinessReport> {
  const now = Date.now();
  if (process.env.NODE_ENV !== "test" && readinessCache && readinessCache.expiresAt > now) {
    return readinessCache.report;
  }
  const report = await checkSystemReadiness(process.env);
  if (process.env.NODE_ENV !== "test") {
    readinessCache = { expiresAt: now + READINESS_CACHE_TTL_MS, report };
  }
  return report;
}

export async function GET() {
  try {
    const report = await getReadinessReport();
    const statusCode = report.overall === "ready" ? 200 : 503;

    if (report.overall !== "ready") {
      console.error("[READY_AUDIT]", JSON.stringify({
        status: report.status,
        overall: report.overall,
        db: report.database,
        caps: Object.entries(report.capabilities).map(([k, v]) => `${k}:${v.enabled}(${v.status},miss:${v.missingDependencies.join(",")},inv:${v.invalidDependencies.join(",")},blk:${v.blockedDependencies.join(",")})`).join("; ")
      }));
    }

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
  } catch (error) {
    console.error("[READY_CATCH_ERROR]", error);
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
