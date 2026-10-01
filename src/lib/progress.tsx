import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { reduceEvents, type ProgressEvent, type UserProgress } from "@/core";
import { api, type AuthTokens, type AuthUser } from "./api";
import { commitSyncedProgress, kvGet, kvSet, outboxAdd, outboxAll, wipeAll } from "./storage";
import { authAdoptionMode, ProgressSyncCoordinator } from "./sync";

export function deviceTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

interface ProgressContextValue {
  progress: UserProgress;
  user: AuthUser | null;
  addEvents: (events: ProgressEvent[]) => void;
  adoptAuth: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  syncNow: () => Promise<void>;
  pendingCount: number;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [outbox, setOutbox] = useState<ProgressEvent[]>(() => outboxAll());
  const [baseline, setBaseline] = useState<UserProgress | null>(() => kvGet<UserProgress>("baseline"));
  const [auth, setAuth] = useState<AuthTokens | null>(() => kvGet<AuthTokens>("auth"));
  const [tick, setTick] = useState(0);
  const syncCoordinator = useRef<ProgressSyncCoordinator | null>(null);
  if (!syncCoordinator.current) {
    syncCoordinator.current = new ProgressSyncCoordinator(
      {
        readOutbox: outboxAll,
        push: async (tokens, events) => {
          const response = await api.sync(tokens.accessToken, events);
          return {
            progress: response.progress,
            // A successful /sync resolves every sent event: valid rows are
            // inserted idempotently and rejected poison rows are reported.
            acknowledgedIds: events.map((event) => event.id),
          };
        },
        refresh: api.refresh,
        commit: commitSyncedProgress,
        onTokens: (tokens) => {
          kvSet("auth", tokens);
          setAuth(tokens);
        },
        onCommit: (progress, remaining) => {
          setBaseline(progress);
          setOutbox(remaining);
        },
      },
      auth,
    );
  }

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const progress = useMemo(
    () => reduceEvents(outbox, deviceTz(), Date.now(), baseline ?? undefined),
    [outbox, baseline, tick],
  );

  const addEvents = useCallback((events: ProgressEvent[]) => {
    outboxAdd(events);
    setOutbox(outboxAll());
  }, []);

  const syncNow = useCallback(async () => {
    await syncCoordinator.current!.sync().catch(() => {});
  }, []);

  const adoptAuth = useCallback(async (tokens: AuthTokens) => {
    const mode = authAdoptionMode(
      syncCoordinator.current!.currentSession()?.tokens.user.id ?? null,
      tokens.user.id,
    );
    syncCoordinator.current!.setSession(tokens);
    if (mode === "account-switch") {
      wipeAll();
      setBaseline(null);
      setOutbox([]);
    }
    kvSet("auth", tokens);
    setAuth(tokens);
    await syncCoordinator.current!.sync().catch(() => {});
  }, []);

  const logout = useCallback(() => {
    syncCoordinator.current!.setSession(null);
    wipeAll();
    setAuth(null);
    setBaseline(null);
    setOutbox([]);
  }, []);

  useEffect(() => {
    if (!auth || outbox.length === 0) return;
    const timer = setTimeout(() => void syncNow(), 2000);
    return () => clearTimeout(timer);
  }, [auth, outbox, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

  useEffect(() => {
    if (!auth) return;
    const tz = deviceTz();
    const session = syncCoordinator.current!.currentSession();
    if (!session || session.tokens.user.tz === tz) return;
    api
      .updateMe(session.tokens.accessToken, { tz })
      .then(({ user }) => {
        const next = syncCoordinator.current!.applyUserUpdate(session, user);
        if (!next) return;
        kvSet("auth", next);
        setAuth(next);
      })
      .catch(() => {});
  }, [auth]);

  const value = useMemo(
    () => ({
      progress,
      user: auth?.user ?? null,
      addEvents,
      adoptAuth,
      logout,
      syncNow,
      pendingCount: outbox.length,
    }),
    [progress, auth, addEvents, adoptAuth, logout, syncNow, outbox.length],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used inside ProgressProvider");
  return ctx;
}

export function newEventId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  return cryptoApi?.randomUUID
    ? cryptoApi.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
        const random = (Math.random() * 16) | 0;
        return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
      });
}
