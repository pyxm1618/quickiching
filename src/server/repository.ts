import { createMemoryRepositories, MemoryStore, type RepositoryFacade } from "@/server/repositories/memory";

// Compatibility façade for existing Actions/loaders. New application services
// depend on the focused ports under server/repositories instead of this union.
// The store survives dev HMR; createMemoryRepositories() remains isolated by
// default for tests and explicit local compositions.
const globalRef = globalThis as unknown as { __ICHING_MEMORY_STORE__?: MemoryStore };
const store = globalRef.__ICHING_MEMORY_STORE__ ?? (globalRef.__ICHING_MEMORY_STORE__ = new MemoryStore());

export const repo: RepositoryFacade = createMemoryRepositories(store).repo;
export type Repo = RepositoryFacade;

export type {
  CastResult,
  CastingSession,
  CastingStep,
  Order,
  Preview,
  QualityReview,
  QuestionLock,
  QuestionVersion,
  Reading,
  Reservation,
  Session,
  User,
} from "@/server/repositories/models";
