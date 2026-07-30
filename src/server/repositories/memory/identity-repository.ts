import type { IdentityRepository } from "../identity-repository";
import type { Session, User } from "../models";
import { snapshot } from "./snapshot";
import { memoryId, type MemoryStore } from "./store";

export function createMemoryIdentityRepository(store: MemoryStore): IdentityRepository {
  return {
    createUser(email: string): User {
      const user: User = { id: memoryId("usr"), email, createdAt: new Date() };
      store.users.set(user.id, user);
      return snapshot(user);
    },

    getUserByEmail(email: string): User | undefined {
      for (const user of store.users.values()) if (user.email === email) return snapshot(user);
      return undefined;
    },

    getUser(id: string): User | undefined {
      const user = store.users.get(id);
      return user ? snapshot(user) : undefined;
    },

    createSession(userId: string): Session {
      const session: Session = {
        id: memoryId("ses"),
        userId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      };
      store.sessions.set(session.id, session);
      return snapshot(session);
    },

    getSession(sessionId: string): Session | undefined {
      const session = store.sessions.get(sessionId);
      if (!session) return undefined;
      if (session.expiresAt.getTime() < Date.now()) {
        store.sessions.delete(sessionId);
        return undefined;
      }
      return snapshot(session);
    },
  };
}
