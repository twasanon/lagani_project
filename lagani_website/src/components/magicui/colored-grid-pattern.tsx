"use client";

import { motion } from "motion/react";
import {
  ComponentPropsWithoutRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface ColoredGridPatternProps
  extends ComponentPropsWithoutRef<"svg"> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: string;
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
}

// Random color function - returns stock market colors
const getRandomColor = () => {
  // Choose between red (price down) and green (price up) - NEPSE stock market colors
  const colorType = Math.random() > 0.5 ? "green" : "red";
  
  // Use the specified colors
  if (colorType === "green") {
    return "#10B981"; // Updated green color
  } else {
    return "#EF4444"; // Updated red color
  }
};

export function ColoredGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = "0",
  numSquares = 50,
  className,
  maxOpacity = 0.2,
  duration = 2,
  repeatDelay = 0.5,
  ...props
}: ColoredGridPatternProps) {
  const id = useId();
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Function to get position - wrapped in useCallback
  const getPos = useCallback(() => {
    return [
      Math.floor((Math.random() * dimensions.width) / width),
      Math.floor((Math.random() * dimensions.height) / height),
    ];
  }, [dimensions, width, height]);

  // Memoize generateSquares with useCallback
  const generateSquares = useCallback((count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      pos: getPos(),
      color: getRandomColor(), // Add random color
    }));
  }, [getPos]);
  
  const [squares, setSquares] = useState(() => generateSquares(numSquares));

  // Updated to generate new color
  const updateSquarePosition = useCallback((id: number) => {
    setSquares((currentSquares) =>
      currentSquares.map((sq) =>
        sq.id === id
          ? {
              ...sq,
              pos: getPos(),
              color: getRandomColor(), // New color on update
            }
          : sq,
      ),
    );
  }, [getPos]);

  // Update squares to animate in
  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      setSquares(generateSquares(numSquares));
    }
  }, [dimensions, numSquares, generateSquares]);

  // Resize observer to update container dimensions
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    const currentRef = containerRef.current;
    
    if (currentRef) {
      resizeObserver.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            stroke="currentColor" 
            strokeOpacity={0.2}
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [x, y], id, color }, index) => {
          return (
            <motion.rect
              initial={{ opacity: 0 }}
              animate={{ opacity: maxOpacity }}
              transition={{
                duration: duration,
                repeat: Infinity,
                repeatType: "reverse",
                delay: index * 0.05,
                repeatDelay: repeatDelay,
              }}
              onAnimationComplete={() => {
                if (Math.random() > 0.7) {
                  updateSquarePosition(id);
                }
              }}
              key={`${x}-${y}-${index}`}
              width={width - 1}
              height={height - 1}
              x={x * width + 1}
              y={y * height + 1}
              fill={color}
              strokeWidth="0"
            />
          );
        })}
      </svg>
    </svg>
  );
} 