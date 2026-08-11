"use client";

import { useSyncExternalStore } from "react";

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subscribeToLocalDate(onStoreChange: () => void) {
  let midnightTimer = 0;

  function scheduleNextMidnight() {
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    const delay = Math.max(1_000, nextMidnight.getTime() - now.getTime() + 100);

    midnightTimer = window.setTimeout(() => {
      onStoreChange();
      scheduleNextMidnight();
    }, delay);
  }

  scheduleNextMidnight();
  window.addEventListener("focus", onStoreChange);

  return () => {
    window.clearTimeout(midnightTimer);
    window.removeEventListener("focus", onStoreChange);
  };
}

function getLocalDateSnapshot() {
  return localDateKey(new Date());
}

function getServerDateSnapshot() {
  return null;
}

export function useLocalDateKey() {
  return useSyncExternalStore(
    subscribeToLocalDate,
    getLocalDateSnapshot,
    getServerDateSnapshot
  );
}
