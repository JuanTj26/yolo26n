"use client";

import { useEffect } from "react";
import { story, stageOf } from "@/lib/story";

// One rAF loop: scroll → damped progress, chapter fades, cursor tilt. No React re-renders.
export function StoryDriver() {
  useEffect(() => {
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      story.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      story.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const root = document.documentElement;
    const loop = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      story.target = max > 0 ? window.scrollY / max : 0;
      story.p += (story.target - story.p) * 0.09;
      const p = story.p;
      root.dataset["stage"] = stageOf(p);
      document.querySelectorAll<HTMLElement>("[data-range]").forEach((el) => {
        const [a, b] = (el.dataset["range"] ?? "0,1").split(",").map(Number) as [number, number];
        const fi = Math.min(1, Math.max(0, (p - a) / 0.035));
        const fo = Math.min(1, Math.max(0, (b - p) / 0.035));
        const o = Math.min(fi, fo);
        const dir = p < (a + b) / 2 ? 1 : -1;
        el.style.opacity = o.toFixed(3);
        el.style.transform = `translate3d(0, ${((1 - o) * 40 * dir).toFixed(1)}px, 0)`;
        el.style.filter = o < 0.99 ? `blur(${((1 - o) * 8).toFixed(1)}px)` : "none";
        el.style.visibility = o < 0.01 ? "hidden" : "visible";
      });
      document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
        const d = Number(el.dataset["tilt"] || 1);
        el.style.rotate = `${(story.mouse.y * -4 * d).toFixed(2)}deg ${(story.mouse.x * 6 * d).toFixed(2)}deg 0deg`;
        el.style.translate = `${(story.mouse.x * -6 * d).toFixed(1)}px ${(story.mouse.y * -6 * d).toFixed(1)}px`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);
  return null;
}

