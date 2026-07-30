import { runtimeConfig } from "@/server/config";
import { hasValidBearerSecret } from "@/server/http/bearer-secret";
import { createPostgresPersistence } from "@/server/repositories/postgres";
import { PostgresRuntimeMaintenanceRepository } from "@/server/repositories/postgres/runtime-maintenance-repository";
import { RuntimeMaintenanceService } from "@/server/maintenance/runtime-maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function maintain(request: Request): Promise<Response> {
  const config = runtimeConfig();
  if (config.mode !== "production" || !hasValidBearerSecret(request, config.credentials.cronSecret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const service = new RuntimeMaintenanceService({
      repository: new PostgresRuntimeMaintenanceRepository(persistence.sql),
      entitlement: {
        release: (reservationId, expired) => persistence.atomicRepository.releaseReservation(reservationId, expired, new Date()),
      },
      clock: { now: () => new Date() },
    });
    return Response.json(await service.run(), { headers: { "cache-control": "no-store" } });
  } finally {
    await persistence.close();
  }
}

export const GET = maintain;
export const POST = maintain;
