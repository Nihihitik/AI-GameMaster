"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  const reduce = usePrefersReducedMotion();
  return <MotionConfig reducedMotion={reduce ? "always" : "never"}>{children}</MotionConfig>;
}
