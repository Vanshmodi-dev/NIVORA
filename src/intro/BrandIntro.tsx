import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark, BRAND_MARK_PATHS } from "../components/ui/BrandMark";
import { BRAND } from "../domain/copy";
import { finishIntro } from "./introStore";
import { TIMELINE, buildParticles, crispAlpha, particlePosition, sweepPosition, type Particle } from "./particles";
import styles from "./BrandIntro.module.css";

export const INTRO_TAGLINE = "Your next chapter starts at home.";

const GOLD_BUCKETS = ["rgba(255, 226, 150, A)", "rgba(240, 190, 90, A)", "rgba(212, 160, 60, A)"];

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface Layout {
  vw: number;
  vh: number;
  /** Logo box (house + wordmark) in CSS px. */
  bx: number;
  by: number;
  bw: number;
  bh: number;
  house: number;
  font: number;
  gap: number;
}

export function computeLayout(vw: number, vh: number): Layout {
  const house = Math.round(Math.min(Math.max(vw * 0.16, 84), 170, vh * 0.26));
  const font = Math.round(house * 0.42);
  const gap = Math.round(house * 0.22);
  const bw = Math.min(vw - 32, Math.round(font * 6.4 + 40));
  const bh = house + gap + font + 24;
  return { vw, vh, bw, bh, bx: Math.round((vw - bw) / 2), by: Math.round(vh * 0.5 - bh * 0.78), house, font, gap };
}

/** Draws the canonical mark and the NIVORA wordmark (white, on a transparent canvas) into a box. */
function drawLogo(ctx: CanvasRenderingContext2D, L: Layout, scale: number) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // House mark
  ctx.save();
  ctx.translate((L.bw - L.house) / 2, 8);
  const k = L.house / 32;
  ctx.scale(k, k);
  ctx.lineWidth = 2.2;
  ctx.stroke(new Path2D(BRAND_MARK_PATHS.house));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(BRAND_MARK_PATHS.keyhole.cx, BRAND_MARK_PATHS.keyhole.cy, BRAND_MARK_PATHS.keyhole.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.stroke(new Path2D(BRAND_MARK_PATHS.key));
  ctx.restore();
  // Wordmark, letter-spaced by hand (ctx.letterSpacing is not universal)
  ctx.font = `700 ${L.font}px "Inter Variable", Inter, system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  const letters = BRAND.name.split("");
  const track = L.font * 0.28;
  const widths = letters.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + track * (letters.length - 1);
  let x = (L.bw - total) / 2;
  const y = 8 + L.house + L.gap + L.font * 0.78;
  letters.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i]! + track;
  });
  ctx.restore();
}

function sampleTargets(box: HTMLCanvasElement, L: Layout): [number, number][] {
  const ctx = box.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  const { data, width, height } = ctx.getImageData(0, 0, box.width, box.height);
  const pts: [number, number][] = [];
  const stride = Math.max(1, Math.round(L.house / 90));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (data[(y * width + x) * 4 + 3]! > 140) pts.push([L.bx + x + (((x * 7 + y * 13) % 10) / 10 - 0.5) * stride, L.by + y + (((x * 11 + y * 5) % 10) / 10 - 0.5) * stride]);
    }
  }
  return pts;
}

/**
 * Cinematic brand reveal. Particles of gold flow out of the dark and assemble into the canonical
 * NIVORA mark and wordmark, then the descriptor and tagline appear and a light sweep crosses the logo.
 *
 * Safe by construction: any failure (no canvas, no fonts, thrown error) falls back to the static
 * reveal; a failsafe timer always ends the intro; Skip and Escape work at all times; the app behind
 * is made inert only while the overlay is up.
 */
export function BrandIntro({ onDone = finishIntro, forceStatic = false }: { onDone?: () => void; forceStatic?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [mode, setMode] = useState<"canvas" | "static">(forceStatic || prefersReducedMotion() ? "static" : "canvas");
  const [layout] = useState(() => computeLayout(window.innerWidth, window.innerHeight));
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    window.setTimeout(onDone, mode === "static" ? 0 : TIMELINE.fadeOut);
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Focus Skip, make the app inert while the overlay is up, support Escape.
  useEffect(() => {
    skipRef.current?.focus();
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root?.removeAttribute("inert");
    };
  }, []);

  // Failsafe: the intro can never trap the user, whatever happens.
  useEffect(() => {
    const t = window.setTimeout(() => finishRef.current(), (mode === "static" ? 1600 : TIMELINE.total) + 1500);
    return () => window.clearTimeout(t);
  }, [mode]);

  // Static reveal ends on its own, quickly.
  useEffect(() => {
    if (mode !== "static") return;
    const t = window.setTimeout(() => finishRef.current(), 1200);
    return () => window.clearTimeout(t);
  }, [mode]);

  // Canvas choreography.
  useEffect(() => {
    if (mode !== "canvas") return;
    let raf = 0;
    let cancelled = false;
    const run = async () => {
      try {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) throw new Error("canvas unavailable");
        try {
          await Promise.race([document.fonts?.load('700 40px "Inter Variable"'), new Promise((r) => setTimeout(r, 500))]);
        } catch {
          /* fall back to the system font */
        }
        if (cancelled) return;
        const L = layout;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(L.vw * dpr);
        canvas.height = Math.round(L.vh * dpr);

        // 1) Sample the real logo pixels as particle targets.
        const box = document.createElement("canvas");
        box.width = L.bw;
        box.height = L.bh;
        const bctx = box.getContext("2d", { willReadFrequently: true });
        if (!bctx) throw new Error("no offscreen context");
        drawLogo(bctx, L, 1);
        let targets = sampleTargets(box, L);
        if (targets.length === 0) throw new Error("no logo pixels");
        const MAX = 7000;
        if (targets.length > MAX) {
          const step = targets.length / MAX;
          targets = Array.from({ length: MAX }, (_, i) => targets[Math.floor(i * step)]!);
        }
        const particles: Particle[] = buildParticles(targets, L.vw, L.vh);

        // 2) Crisp gold logo layer (same geometry as the sampled one, so it aligns exactly).
        const gold = document.createElement("canvas");
        gold.width = Math.round(L.bw * dpr);
        gold.height = Math.round(L.bh * dpr);
        const gctx = gold.getContext("2d")!;
        drawLogo(gctx, L, dpr);
        gctx.globalCompositeOperation = "source-in";
        const g = gctx.createLinearGradient(0, 0, gold.width, gold.height);
        g.addColorStop(0, "#fff0c2");
        g.addColorStop(0.5, "#e7b85a");
        g.addColorStop(1, "#b98a2e");
        gctx.fillStyle = g;
        gctx.fillRect(0, 0, gold.width, gold.height);
        const sweep = document.createElement("canvas");
        sweep.width = gold.width;
        sweep.height = gold.height;
        const sctx = sweep.getContext("2d")!;

        const start = performance.now();
        const frame = (now: number) => {
          if (cancelled) return;
          const t = now - start;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, L.vw, L.vh);
          const crisp = crispAlpha(t);

          ctx.globalCompositeOperation = "lighter";
          for (let b = 0; b < 3; b++) {
            const alphaBase = b === 0 ? 0.95 : b === 1 ? 0.8 : 0.65;
            for (let i = b; i < particles.length; i += 3) {
              const p = particles[i]!;
              const pos = particlePosition(p, t);
              if (pos.progress <= 0) continue;
              const a = Math.min(1, pos.progress * 5) * (1 - crisp * 0.8) * alphaBase;
              if (a < 0.02) continue;
              ctx.fillStyle = GOLD_BUCKETS[b]!.replace("A", a.toFixed(2));
              const s = p.size;
              ctx.fillRect(pos.x - s / 2, pos.y - s / 2, s, s);
            }
          }
          ctx.globalCompositeOperation = "source-over";

          if (crisp > 0) {
            ctx.globalAlpha = crisp;
            ctx.drawImage(gold, L.bx, L.by, L.bw, L.bh);
            ctx.globalAlpha = 1;
            const sp = sweepPosition(t);
            if (sp > -0.2 && sp < 1.2) {
              sctx.globalCompositeOperation = "source-over";
              sctx.clearRect(0, 0, sweep.width, sweep.height);
              sctx.drawImage(gold, 0, 0);
              sctx.globalCompositeOperation = "source-atop";
              const cx = sp * sweep.width;
              const w = sweep.width * 0.16;
              const band = sctx.createLinearGradient(cx - w, 0, cx + w, sweep.height * 0.35);
              band.addColorStop(0, "rgba(255,250,230,0)");
              band.addColorStop(0.5, "rgba(255,252,238,0.95)");
              band.addColorStop(1, "rgba(255,250,230,0)");
              sctx.fillStyle = band;
              sctx.fillRect(0, 0, sweep.width, sweep.height);
              ctx.globalCompositeOperation = "lighter";
              ctx.drawImage(sweep, L.bx, L.by, L.bw, L.bh);
              ctx.globalCompositeOperation = "source-over";
            }
          }
          if (t >= TIMELINE.total) {
            finishRef.current();
            return;
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      } catch {
        if (!cancelled) setMode("static");
      }
    };
    void run();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [mode, layout]);

  const L = layout;
  const textTop = L.by + L.bh + 6;
  const isStatic = mode === "static";

  return createPortal(
    <div className={`${styles.overlay} ${leaving ? styles.leaving : ""} ${isStatic ? styles.static : ""}`} role="region" aria-label="NIVORA introduction" data-testid="brand-intro" data-mode={mode}>
      <div className={styles.vignette} aria-hidden="true" />
      {!isStatic && <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" style={{ width: L.vw, height: L.vh }} />}
      {isStatic && (
        <div className={styles.staticLogo} style={{ top: L.by, height: L.bh }}>
          <BrandMark size={L.house} />
          <span className={styles.staticName} style={{ fontSize: L.font }}>{BRAND.name}</span>
        </div>
      )}
      <div className={styles.copy} style={{ top: textTop }}>
        <p className={styles.descriptor} style={isStatic ? undefined : { animationDelay: `${TIMELINE.descriptorAt}ms` }}>{BRAND.descriptor}</p>
        <p className={styles.tagline} style={isStatic ? undefined : { animationDelay: `${TIMELINE.taglineAt}ms` }}>{INTRO_TAGLINE}</p>
      </div>
      <p className="visually-hidden">{BRAND.name}, {BRAND.descriptor}</p>
      <button ref={skipRef} type="button" className={styles.skip} onClick={finish}>Skip intro</button>
    </div>,
    document.body,
  );
}
