import { createMemoryRepositories, MemoryStore, type RepositoryFacade } from "@/server/repositories/memory";

// Compatibility façade for existing Actions/loaders. New application services
// depend on the focused ports under server/repositories instead of this union.
// The store survives dev HMR; createMemoryRepositories() remains isolated by
// default for tests and explicit local compositions.
const globalRef = globalThis as unknown as { __ICHING_MEMORY_STORE__?: MemoryStore };
const store = globalRef.__ICHING_MEMORY_STORE__ ?? (globalRef.__ICHING_MEMORY_STORE__ = new MemoryStore());
const repositories = createMemoryRepositories(store);

export const repo: RepositoryFacade = repositories.repo;
export const castingRepository = repositories.castingRepository;
export const loginIntentRepository = repositories.loginIntentRepository;
export const revealRepository = repositories.revealRepository;
export const readingRepository = repositories.readingRepository;
export const entitlementRepository = repositories.entitlementRepository;
export const reviewRepository = repositories.reviewRepository;
export const privacyRepository = repositories.privacyRepository;
export const historyRepository = repositories.historyRepository;
export type Repo = RepositoryFacade;

export type {
  AccountDeletionRequest,
  CastResult,
  CastingSession,
  CastingStep,
  LoginIntent,
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
