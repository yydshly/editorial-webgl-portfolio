"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { useRuntime } from "@/lib/motion/RuntimeProvider";
import type { Unsubscribe } from "@/lib/motion/types";
import type MotionBus from "@/lib/motion/MotionBus";
import ScrollLockService from "@/lib/scroll/ScrollLockService";
import ScrollRuntime from "@/lib/scroll/ScrollRuntime";

type LenisContextValue = {
  readonly bus: MotionBus;
  readonly runtime: ScrollRuntime;
  readonly lockService: ScrollLockService;
};

const LenisContext = createContext<LenisContextValue | null>(null);
const noopUnsubscribe: Unsubscribe = () => {};

export default function LenisProvider({
  children,
}: Readonly<{
  readonly children: React.ReactNode;
}>) {
  const { bus, frame } = useRuntime();
  const [lockService] = useState(() => new ScrollLockService());
  const [runtime] = useState(() => new ScrollRuntime(bus, lockService, frame));

  useEffect(() => {
    let mounted = true;

    void runtime.connect().catch(() => {
      if (!mounted) {
        return;
      }
      runtime.dispose();
    });

    return () => {
      mounted = false;
      runtime.dispose();
    };
  }, [runtime]);

  return (
    <LenisContext.Provider value={{ bus, runtime, lockService }}>
      {children}
    </LenisContext.Provider>
  );
}

export function useLenis(): LenisContextValue {
  const ctx = useContext(LenisContext);
  if (!ctx) {
    throw new Error("useLenis must be used within a LenisProvider");
  }
  return ctx;
}

export function useScrollLock(): {
  readonly lock: () => Unsubscribe;
} {
  const ctx = useContext(LenisContext);
  if (!ctx) {
    return {
      lock: () => noopUnsubscribe,
    };
  }

  const { lockService } = ctx;

  const lock = (): Unsubscribe => {
    return lockService.acquire();
  };

  return { lock };
}
