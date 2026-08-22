import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore } from "idb-keyval";

const BUSTER = "lafz-v1";
const CACHE_KEY = "lafz-query-cache";

const PERSIST_KEYS = new Set([
  "words",
  "word",
  "review-queue",
  "quiz-words",
  "profile-stats",
  "grammar-stats",
  "practice-queue-due",
  "practice-queue-recent",
]);

export function useOfflineCache(queryClient: QueryClient) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const store = createStore("lafz-cache", "queries");
    const persister = createAsyncStoragePersister({
      storage: {
        getItem: (key) => get(key, store).then((v) => (v as string | undefined) ?? null),
        setItem: (key, value) => set(key, value, store),
        removeItem: (key) => del(key, store),
      },
      key: CACHE_KEY,
      throttleTime: 1000,
    });

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      buster: BUSTER,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          if (query.state.status !== "success") return false;
          const root = String(query.queryKey[0] ?? "");
          return PERSIST_KEYS.has(root);
        },
      },
    });

    return () => unsubscribe();
  }, [queryClient]);
}
