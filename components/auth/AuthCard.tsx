"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Premium frosted-glass auth card with an optional pointer-driven 3D tilt and a
 * cursor-following specular sheen.
 *
 * - Tilt is enabled only for fine pointers (mouse/trackpad) and is disabled when
 *   the user prefers reduced motion — touch users and reduced-motion users get a
 *   clean static card.
 * - Only `transform` animates during interaction (60fps); pointer math is rAF-
 *   throttled. The entrance animation lives on a wrapper so it never competes
 *   with the tilt transform.
 */
export function AuthCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<number | null>(null);
  const [interactive, setInteractive] = React.useState(false);

  React.useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    setInteractive(fine && !reduced);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!interactive || !el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width; // 0..1
    const py = (event.clientY - rect.top) / rect.height; // 0..1
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const max = 5; // degrees — subtle, premium
      el.style.setProperty("--ry", `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty("--rx", `${-(py - 0.5) * 2 * max}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    });
  };

  const handlePointerLeave = () => {
    const el = cardRef.current;
    if (!el) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div className="auth-enter w-full">
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn("auth-surface auth-card p-6 sm:p-8", className)}
      >
        <span aria-hidden className="auth-card-sheen" />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

export default AuthCard;
