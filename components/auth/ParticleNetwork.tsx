"use client";

import * as React from "react";

/**
 * Lightweight, dependency-free particle "constellation" network rendered to a
 * <canvas>. Nodes drift across a near-black field and link with thin teal/cyan
 * lines when they come close; each node carries a depth (z) that drives its
 * size, speed, brightness, and how much it parallax-shifts with the pointer —
 * giving the field a subtle 3D feel.
 *
 * Performance & a11y:
 * - DPR-capped at 2, node count scales with viewport area (capped).
 * - O(n²) linking stays cheap at the capped node count.
 * - Pauses when the tab is hidden.
 * - Honours prefers-reduced-motion: draws a single static frame, no animation.
 */
export function ParticleNetwork({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Deep-blue node palette (RGB triplets).
    const PALETTE = ["59, 130, 246", "96, 165, 250", "56, 189, 248"];
    const LINE_RGB = "96, 165, 250";
    const LINK_DIST = 132; // px (CSS space)

    type P = {
      x: number;
      y: number;
      z: number; // 0 (far) .. 1 (near)
      vx: number;
      vy: number;
      r: number;
      c: string;
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: P[] = [];
    let raf = 0;
    const pointer = { x: 0.5, y: 0.5, active: false };

    const seed = (n: number) => {
      particles = Array.from({ length: n }, () => {
        const z = Math.random();
        const speed = 0.1 + z * 0.34; // nearer = faster
        const a = Math.random() * Math.PI * 2;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          z,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          r: 0.6 + z * 1.7,
          c: PALETTE[(Math.random() * PALETTE.length) | 0],
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.round(rect.width) || window.innerWidth;
      height = Math.round(rect.height) || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(
        120,
        Math.max(34, Math.round((width * height) / 16000))
      );
      seed(target);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const offX = pointer.active ? (pointer.x - 0.5) * 28 : 0;
      const offY = pointer.active ? (pointer.y - 0.5) * 28 : 0;

      // advance + wrap
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -24) p.x = width + 24;
        else if (p.x > width + 24) p.x = -24;
        if (p.y < -24) p.y = height + 24;
        else if (p.y > height + 24) p.y = -24;
      }

      // links
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const ax = a.x + offX * a.z;
        const ay = a.y + offY * a.z;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const bx = b.x + offX * b.z;
          const by = b.y + offY * b.z;
          const dx = ax - bx;
          const dy = ay - by;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            const alpha =
              (1 - d / LINK_DIST) * 0.45 * ((a.z + b.z) / 2 + 0.25);
            ctx.strokeStyle = `rgba(${LINE_RGB}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      // nodes
      for (const p of particles) {
        const px = p.x + offX * p.z;
        const py = p.y + offY * p.z;
        ctx.fillStyle = `rgba(${p.c}, ${0.3 + p.z * 0.55})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onResize = () => resize();
    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX / window.innerWidth;
      pointer.y = e.clientY / window.innerHeight;
      pointer.active = true;
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduced && !raf) {
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      particles.forEach((p) => {
        p.vx = 0;
        p.vy = 0;
      });
      draw(); // single static frame
    } else {
      window.addEventListener("pointermove", onPointer, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}

export default ParticleNetwork;
