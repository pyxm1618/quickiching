import {
  createMemoryRepositories,
  MemoryStore,
  type MemoryRepositories,
  type RepositoryFacade,
} from "@/server/repositories/memory";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { LoginIntentRepository } from "@/server/repositories/login-intent-repository";
import type { RevealRepository } from "@/server/repositories/reveal-repository";
import type { ReadingRepository } from "@/server/repositories/reading-repository";
import type { EntitlementRepository } from "@/server/repositories/entitlement-repository";
import type { ReviewRepository } from "@/server/repositories/review-repository";
import type { PrivacyRepository } from "@/server/repositories/privacy-repository";
import { runtimeConfig } from "@/server/config";

// Local compatibility ports are deliberately lazy. Importing this module in a
// production route never allocates an in-memory store. Any un-migrated
// production call fails closed instead of silently losing state on restart.
const globalRef = globalThis as unknown as {
  __ICHING_MEMORY_STORE__?: MemoryStore;
  __ICHING_MEMORY_REPOSITORIES__?: MemoryRepositories;
};

function localRepositories(): MemoryRepositories {
  if (runtimeConfig().mode === "production") {
    throw new Error("MEMORY_REPOSITORY_FORBIDDEN_IN_PRODUCTION");
  }
  if (!globalRef.__ICHING_MEMORY_REPOSITORIES__) {
    const store = globalRef.__ICHING_MEMORY_STORE__
      ?? (globalRef.__ICHING_MEMORY_STORE__ = new MemoryStore());
    globalRef.__ICHING_MEMORY_REPOSITORIES__ = createMemoryRepositories(store);
  }
  return globalRef.__ICHING_MEMORY_REPOSITORIES__;
}

function lazyPort<T extends object>(select: (repositories: MemoryRepositories) => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = select(localRepositories());
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(_target, property, value) {
      const target = select(localRepositories());
      return Reflect.set(target, property, value);
    },
  });
}

export const repo: RepositoryFacade = lazyPort((repositories) => repositories.repo);
export const castingRepository: CastingRepository = lazyPort((repositories) => repositories.castingRepository);
export const loginIntentRepository: LoginIntentRepository = lazyPort((repositories) => repositories.loginIntentRepository);
export const revealRepository: RevealRepository = lazyPort((repositories) => repositories.revealRepository);
export const readingRepository: ReadingRepository = lazyPort((repositories) => repositories.readingRepository);
export const entitlementRepository: EntitlementRepository = lazyPort((repositories) => repositories.entitlementRepository);
export const reviewRepository: ReviewRepository = lazyPort((repositories) => repositories.reviewRepository);
export const privacyRepository: PrivacyRepository = lazyPort((repositories) => repositories.privacyRepository);
export type Repo = RepositoryFacade;

export type {
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
