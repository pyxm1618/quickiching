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

    console.info("[PROD_AI_CONFIG_AUDIT]", JSON.stringify({
      apiKeyPrefix: process.env.AI_GATEWAY_API_KEY ? process.env.AI_GATEWAY_API_KEY.slice(0, 4) : "empty",
      apiKeyLength: process.env.AI_GATEWAY_API_KEY?.length ?? 0,
      modelDeepReading: process.env.AI_MODEL_DEEP_READING ?? "empty",
      modelReview: process.env.AI_MODEL_OUTPUT_REVIEW ?? "empty",
      aiSdkGatewayBaseUrl: process.env.AI_SDK_GATEWAY_BASE_URL ?? "empty",
      aiGatewayBaseUrl: process.env.AI_GATEWAY_BASE_URL ?? "empty",
    }));

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
