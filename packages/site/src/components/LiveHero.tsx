/**
 * The live hero of the home page. Boxes drift on graph paper. In each frame, two compiled Vex programs evaluate at
 * each box. The first gives the distance to each other box, and an arrow goes to the nearest one. The second gives
 * the number of boxes that the box overlaps, and a box that overlaps another box has a red edge. The counter shows
 * the number of evaluations and their time.
 *
 * When the reader points at a box, the hero shows the list of the first program at that box. Each item of the list is
 * a dashed line with a distance. With "reduce motion", the boxes do not move until the reader selects "Play".
 */
import { compile, isVexList, space, vex, type Program, type Space } from "@mark1russell7/vex";
import { BoolDomain, NumDomain, Vec2, Vec2Domain } from "@mark1russell7/vex-domains";
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement } from "react";
import { Code } from "./Code.tsx";

const W = 30;
const H = 18;
const U = 16;
const N = 9;
const KEYS = Array.from({ length: N }, (_, i) => String.fromCharCode(65 + i));
const DOMAINS = [Vec2Domain, NumDomain, BoolDomain] as const;

interface Mover {
  readonly position: Vec2;
  readonly size: Vec2;
  readonly v: Vec2;
}

/** The start state: a fixed seed, so each visit starts with the same picture. */
function start(): Readonly<Record<string, Mover>> {
  let x = 7;
  const next = (): number => {
    x = (x * 16807) % 2147483647;
    return x / 2147483647;
  };
  return Object.fromEntries(
    KEYS.map((k) => {
      const size = new Vec2(2 + Math.floor(next() * 3), 2 + Math.floor(next() * 3));
      const position = new Vec2(next() * (W - size.x), next() * (H - size.y));
      const angle = next() * Math.PI * 2;
      return [k, { position, size, v: new Vec2(Math.cos(angle) * 1.4, Math.sin(angle) * 1.4) }];
    }),
  );
}

/** One step of the motion: each box moves, and bounces at the edges of the paper. */
function step(movers: Readonly<Record<string, Mover>>, dt: number): Readonly<Record<string, Mover>> {
  return Object.fromEntries(
    Object.entries(movers).map(([k, m]) => {
      let { x, y } = m.position.add(m.v.scale(dt));
      let vx = m.v.x;
      let vy = m.v.y;
      if (x < 0 || x > W - m.size.x) {
        vx = -vx;
        x = Math.min(Math.max(x, 0), W - m.size.x);
      }
      if (y < 0 || y > H - m.size.y) {
        vy = -vy;
        y = Math.min(Math.max(y, 0), H - m.size.y);
      }
      return [k, { position: new Vec2(x, y), size: m.size, v: new Vec2(vx, vy) }];
    }),
  );
}

/** The two programs, built once with the typed builder and compiled once. */
function programs(): { readonly distances: Program; readonly overlaps: Program } {
  const root = vex(...DOMAINS).over(space.record(start()));
  const centre = root.from("size")._.halve()._.add("position");
  const distances = centre.others((e) => e._.distance(e.from("size")._.halve()._.add("position")));
  const overlaps = root
    .start(0)
    .others((e) => e, {
      where: (e) =>
        e.origin().from("position")._.add(e.origin().from("size"))._.subtract(e.from("position"))._.allPositive()._.and(
          e.from("position")._.add(e.from("size"))._.subtract(e.origin().from("position"))._.allPositive(),
        ),
    })
    .count();
  return { distances: compile(distances.program, { domains: DOMAINS }), overlaps: compile(overlaps.program, { domains: DOMAINS }) };
}

/** The code of the program in the caption. */
const CODE = `const centre = root.from("size")
  ._.halve()._.add("position");
centre.others((e) => e._.distance(
  e.from("size")._.halve()._.add("position")));`;

/** The point where the line from the centre of `from` to the centre of `to` meets the edge of `to`. */
function edge(from: Mover, to: Mover): readonly [number, number] {
  const cx = (to.position.x + to.size.x / 2) * U;
  const cy = (to.position.y + to.size.y / 2) * U;
  const dx = (from.position.x + from.size.x / 2) * U - cx;
  const dy = (from.position.y + from.size.y / 2) * U - cy;
  const s = Math.min(Math.abs(dx) > 1e-9 ? (to.size.x * U) / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? (to.size.y * U) / 2 / Math.abs(dy) : Infinity);
  return Number.isFinite(s) && s < 1 ? [cx + dx * s, cy + dy * s] : [cx, cy];
}

interface Frame {
  readonly lists: Readonly<Record<string, readonly { readonly key: string; readonly d: number }[]>>;
  readonly nearest: Readonly<Record<string, { readonly key: string; readonly d: number }>>;
  readonly overlapping: ReadonlySet<string>;
  readonly runs: number;
  readonly ms: number;
}

function evaluateFrame(p: { readonly distances: Program; readonly overlaps: Program }, s: Space): Frame {
  const t0 = performance.now();
  const lists: Record<string, { key: string; d: number }[]> = {};
  const nearest: Record<string, { key: string; d: number }> = {};
  const overlapping = new Set<string>();
  for (const k of s.keys) {
    const r = p.distances.run({ space: s, origin: k });
    if (r.ok && isVexList(r.value)) {
      const list: { key: string; d: number }[] = [];
      lists[k] = list;
      for (const item of r.value.items) {
        if (!item.result.ok || typeof item.result.value !== "number") continue;
        list.push({ key: item.key, d: item.result.value });
        const best = nearest[k];
        if (best === undefined || item.result.value < best.d) nearest[k] = { key: item.key, d: item.result.value };
      }
    }
    const o = p.overlaps.run({ space: s, origin: k });
    if (o.ok && typeof o.value === "number" && o.value > 0) overlapping.add(k);
  }
  return { lists, nearest, overlapping, runs: s.keys.length * 2, ms: performance.now() - t0 };
}

/** The live hero. */
export default function LiveHero(): ReactElement {
  const compiled = useMemo(programs, []);
  const [movers, setMovers] = useState(start);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ms, setMs] = useState(0);
  const [focus, setFocus] = useState<string | undefined>(undefined);
  const root = useRef<HTMLElement>(null);

  // Motion starts only when the reader does not ask for reduced motion.
  useEffect(() => {
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The animation stops when the hero is not on the screen.
  useEffect(() => {
    const el = root.current;
    if (el === null || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(e?.isIntersecting ?? true));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !visible) return;
    let raf = 0;
    let last = performance.now();
    // The time comes from performance.now(), the same clock as "last", and not from the argument of the callback.
    const tick = (): void => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setMovers((m) => step(m, dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible]);

  const frame = useMemo(() => evaluateFrame(compiled, space.record(movers)), [compiled, movers]);

  // The time shown is a running average, so the number is readable.
  useEffect(() => {
    setMs((old) => (old === 0 ? frame.ms : old * 0.9 + frame.ms * 0.1));
  }, [frame]);

  // The box under the pointer. The last box in the list is on top, so the search goes from the end.
  const point = (e: PointerEvent<SVGSVGElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const hit = KEYS.findLast((k) => {
      const m = movers[k];
      return m !== undefined && x >= m.position.x && x <= m.position.x + m.size.x && y >= m.position.y && y <= m.position.y + m.size.y;
    });
    setFocus(hit);
  };
  const focused = focus === undefined ? undefined : movers[focus];
  const list = focus === undefined ? undefined : frame.lists[focus];
  const best = focus === undefined ? undefined : frame.nearest[focus];

  return (
    <figure ref={root} className="vx-hero-live" aria-label="Live: Vex programs evaluate at each box in each frame">
      <svg viewBox={`0 0 ${W * U} ${H * U}`} onPointerMove={point} onPointerDown={point} onPointerLeave={() => setFocus(undefined)} role="img" aria-label="Boxes that move. An arrow goes from each box to its nearest other box. A box with a red edge overlaps another box.">
        <defs>
          <pattern id="vx-hero-grid" width={U} height={U} patternUnits="userSpaceOnUse">
            <path d={`M ${U} 0 L 0 0 0 ${U}`} fill="none" stroke="var(--color-grid)" strokeWidth={1} />
          </pattern>
          <marker id="vx-hero-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="var(--color-accent)" />
          </marker>
        </defs>
        <rect width={W * U} height={H * U} fill="url(#vx-hero-grid)" />
        {KEYS.map((k) => {
          const m = movers[k];
          if (m === undefined) return null;
          const hit = frame.overlapping.has(k);
          return (
            <rect
              key={k}
              x={m.position.x * U}
              y={m.position.y * U}
              width={m.size.x * U}
              height={m.size.y * U}
              rx={3}
              fill={hit ? "var(--color-mark-wash)" : "var(--color-accent-wash)"}
              stroke={k === focus ? "var(--color-accent)" : hit ? "var(--color-mark)" : "var(--color-ink)"}
              strokeWidth={k === focus ? 3 : hit ? 2.5 : 1.5}
            />
          );
        })}
        {focused === undefined || list === undefined
          ? null
          : list.map((item) => {
              const t = movers[item.key];
              if (t === undefined) return null;
              const [x1, y1] = edge(t, focused);
              const [x2, y2] = edge(focused, t);
              return <line key={`l-${item.key}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} pointerEvents="none" />;
            })}
        {KEYS.map((k) => {
          const n = frame.nearest[k];
          const a = movers[k];
          const b = n === undefined ? undefined : movers[n.key];
          if (a === undefined || b === undefined) return null;
          const [x1, y1] = edge(b, a);
          const [x2, y2] = edge(a, b);
          return <line key={`a-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-accent)" strokeWidth={2} markerEnd="url(#vx-hero-arrow)" />;
        })}
        <g pointerEvents="none" style={{ paintOrder: "stroke" }} stroke="var(--color-surface)" strokeWidth={4} strokeLinejoin="round">
          {focused === undefined || list === undefined
            ? null
            : list.map((item) => {
                const t = movers[item.key];
                if (t === undefined) return null;
                const [x1, y1] = edge(t, focused);
                const [x2, y2] = edge(focused, t);
                return (
                  <text key={`d-${item.key}`} x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fontWeight={item.key === best?.key ? 700 : 400} fill="var(--color-accent)">
                    {item.d.toFixed(1)}
                  </text>
                );
              })}
          {KEYS.map((k) => {
            const m = movers[k];
            return m === undefined ? null : (
              <text key={k} x={m.position.x * U + 5} y={m.position.y * U + 15} fontFamily="var(--font-mono)" fontSize={13} fontWeight={700} fill="var(--color-ink)">
                {k}
              </text>
            );
          })}
        </g>
      </svg>
      <figcaption>
        <pre className="vx-hero-code">
          <Code code={CODE} />
        </pre>
        <span className="vx-hero-legend">
          {focus === undefined || list === undefined ? (
            <>
              <span style={{ color: "var(--color-accent)" }}>arrow</span>: the nearest other box.{" "}
              <span style={{ color: "var(--color-mark)" }}>red edge</span>: the box overlaps another box. Point at a box to see its list.
            </>
          ) : (
            <>
              At <strong>{focus}</strong>, the program gives a list of {list.length} distances. The minimum is{" "}
              <strong style={{ color: "var(--color-accent)" }}>{best?.d.toFixed(2)}</strong>, to {best?.key}.
            </>
          )}
        </span>
        <span className="vx-hero-stats">
          {frame.runs} programs in {ms.toFixed(2)} ms each frame
        </span>
        <button type="button" className="vx-button" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </button>
      </figcaption>
    </figure>
  );
}
