"use client";

import dynamic from "next/dynamic";

// Import ColoredGridPattern dynamically with SSR disabled
const ColoredGridPattern = dynamic(
  () => import("@/components/magicui/colored-grid-pattern").then(mod => mod.ColoredGridPattern),
  { ssr: false }
);

// Props interface with children excluded since we don't need it
interface ClientGridPatternProps {
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  className?: string;
}

export function ClientGridPattern({
  numSquares,
  maxOpacity,
  duration,
  className,
}: ClientGridPatternProps) {
  return (
    <ColoredGridPattern
      numSquares={numSquares}
      maxOpacity={maxOpacity}
      duration={duration}
      className={className}
    />
  );
} 