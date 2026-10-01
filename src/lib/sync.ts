import type { ProgressEvent, UserProgress } from "@/core";
import type { AuthTokens } from "./api";

export interface ProgressSyncResult {
  progress: UserProgress;
  acknowledgedIds: string[];
}

export interface SyncSessionSnapshot {
  generation: number;
  tokens: AuthTokens;
}

export function authAdoptionMode(
  currentUserId: string | null,
  nextUserId: string,
): "guest" | "same-account" | "account-switch" {
  if (currentUserId === null) return "guest";
  return currentUserId === nextUserId ? "same-account" : "account-switch";
}

export interface ProgressSyncDependencies {
  readOutbox(): ProgressEvent[];
  push(tokens: AuthTokens, events: ProgressEvent[]): Promise<ProgressSyncResult>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  commit(progress: UserProgress, acknowledgedIds: string[]): void;
  onTokens(tokens: AuthTokens): void;
  onCommit(progress: UserProgress, remaining: ProgressEvent[]): void;
}

/** Serial sync bound to the auth generation that issued each request. */
export class ProgressSyncCoordinator {
  private generation = 0;
  private tokens: AuthTokens | null;
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly dependencies: ProgressSyncDependencies,
    initialTokens: AuthTokens | null,
  ) {
    this.tokens = initialTokens;
  }

  setSession(tokens: AuthTokens | null): void {
    this.generation += 1;
    this.tokens = tokens;
  }

  currentSession(): SyncSessionSnapshot | null {
    return this.tokens ? { generation: this.generation, tokens: this.tokens } : null;
  }

  updateSessionTokens(tokens: AuthTokens): void {
    if (this.tokens?.user.id === tokens.user.id) this.tokens = tokens;
  }

  applyUserUpdate(
    snapshot: SyncSessionSnapshot,
    user: AuthTokens["user"],
  ): AuthTokens | null {
    if (
      snapshot.generation !== this.generation ||
      this.tokens?.user.id !== snapshot.tokens.user.id
    ) {
      return null;
    }
    // Preserve credentials that may have refreshed while updateMe was in flight.
    this.tokens = { ...this.tokens, user };
    return this.tokens;
  }

  sync(): Promise<void> {
    const requestedGeneration = this.generation;
    const operation = this.tail.then(() => this.runOnce(requestedGeneration));
    this.tail = operation.catch(() => undefined);
    return operation;
  }

  private async runOnce(requestedGeneration: number): Promise<void> {
    if (requestedGeneration !== this.generation) return;
    let tokens = this.tokens;
    if (!tokens) return;
    const batch = this.dependencies.readOutbox().slice(0, 500);
    let result: ProgressSyncResult;
    try {
      result = await this.dependencies.push(tokens, batch);
    } catch (error) {
      if (!error || typeof error !== "object" || !("status" in error) || error.status !== 401) {
        throw error;
      }
      if (requestedGeneration !== this.generation) return;
      const fresh = await this.dependencies.refresh(tokens.refreshToken);
      if (requestedGeneration !== this.generation) return;
      tokens = fresh;
      this.tokens = fresh;
      this.dependencies.onTokens(fresh);
      result = await this.dependencies.push(fresh, batch);
    }
    if (requestedGeneration !== this.generation || this.tokens?.user.id !== tokens.user.id) return;
    const requestedIds = new Set(batch.map((event) => event.id));
    const acknowledgedIds = result.acknowledgedIds.filter((id) => requestedIds.has(id));
    this.dependencies.commit(result.progress, acknowledgedIds);
    this.dependencies.onCommit(result.progress, this.dependencies.readOutbox());
  }
}
