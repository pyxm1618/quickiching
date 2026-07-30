import type { Session, User } from "./models";

export interface IdentityRepository {
  createUser(email: string): User;
  getUserByEmail(email: string): User | undefined;
  getUser(id: string): User | undefined;
  createSession(userId: string): Session;
  getSession(sessionId: string): Session | undefined;
}
