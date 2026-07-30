export type TimedOutJobRecovery = {
  jobId: string;
  terminal: boolean;
  reservationId: string | null;
};

export interface RuntimeMaintenanceRepository {
  cleanupCastingAndTokens(now: Date): Promise<{
    expiredCastings: number;
    deletedTokens: number;
    deletedLocks: number;
  }>;
  recoverTimedOutJobs(now: Date): Promise<TimedOutJobRecovery[]>;
  purgeDeletedCasts(now: Date): Promise<number>;
}

export class RuntimeMaintenanceService {
  constructor(private readonly dependencies: {
    repository: RuntimeMaintenanceRepository;
    entitlement: { release(reservationId: string, expired: boolean): unknown | Promise<unknown> };
    clock: { now(): Date };
  }) {}

  async run(): Promise<{
    expiredCastings: number;
    deletedTokens: number;
    deletedLocks: number;
    recoveredJobs: number;
    terminalJobs: number;
    purgedCasts: number;
    releasedReservations: number;
  }> {
    const now = this.dependencies.clock.now();
    const cleanup = await this.dependencies.repository.cleanupCastingAndTokens(now);
    const jobs = await this.dependencies.repository.recoverTimedOutJobs(now);
    let releasedReservations = 0;
    for (const job of jobs) {
      if (job.terminal && job.reservationId) {
        await this.dependencies.entitlement.release(job.reservationId, false);
        releasedReservations++;
      }
    }
    const purgedCasts = await this.dependencies.repository.purgeDeletedCasts(now);
    return {
      ...cleanup,
      recoveredJobs: jobs.filter((job) => !job.terminal).length,
      terminalJobs: jobs.filter((job) => job.terminal).length,
      purgedCasts,
      releasedReservations,
    };
  }
}
