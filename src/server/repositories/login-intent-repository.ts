import type { LoginIntent } from "./models";

export type CreateLoginIntentInput = {
  castingSessionId: string;
  anonymousSessionHash: string;
  nonceHash: string;
  nonceKeyVersion: string;
  allowedCallbackPath: string;
  expiresAt: Date;
  createdAt: Date;
};

export interface LoginIntentRepository {
  createLoginIntent(input: CreateLoginIntentInput): LoginIntent;
  getLoginIntent(intentId: string): LoginIntent | undefined;
}
