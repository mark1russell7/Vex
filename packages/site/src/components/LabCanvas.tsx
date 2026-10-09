/**
 * The canvases of the Lab: one picture for each kind of space. Each picture shows the records and the result of the
 * program at each record. A click on a record selects it as the origin of the trace.
 */
import { isVexList, type Result } from "@mark1russell7/vex";
import { Vec2 } from "@mark1russell7/vex-domains";
import type { ReactElement } from "react";
import { show } from "../lib/format.ts";
import { LIFE_ROWS, PARENTS, PEOPLE, ROWS, type LabSpaceId } from "../lib/lab-spaces.ts";
import type { BoxKey, Boxes } from "../lib/specimen.ts";
import { SpaceView, UNIT } from "./SpaceView.tsx";

/** The properties of a canvas. */
export interface LabCanvasProps {
  readonly space: LabSpaceId;
  readonly boxes: Boxes;
  readonly results: ReadonlyMap<string, Result<unknown>>;
  readonly origin: string;
  readonly onSelect: (key: string) => void;
}

/** This function gives a short text for a result, for a small label. */
function label(r: Result<unknown> | undefined): string {
  if (r === undefined) return "";
  if (!r.ok) return r.error.code;
  if (isVexList(r.value)) return `list(${r.value.items.length})`;
  const text = show(r.value);
  return text.length > 14 ? `${text.slice(0, 13)}…` : text;
}

/** The colour of a result: red for an error, the accent for true, the muted ink for false. */
const tone = (r: Result<unknown> | undefined): string =>
  r === undefined ? "var(--color-ink-muted)" : !r.ok ? "var(--color-mark)" : r.value === true ? "var(--color-accent)" : r.value === false ? "var(--color-ink-muted)" : "var(--color-ink)";

/** A small result chip in SVG. */
function Chip(props: { readonly x: number; readonly y: number; readonly r: Result<unknown> | undefined; readonly anchor?: "start" | "middle" | "end" }): ReactElement {
  return (
    <text
      x={props.x}
      y={props.y}
      textAnchor={props.anchor ?? "start"}
      fontFamily="var(--font-mono)"
      fontSize={12}
      fontWeight={700}
      fill={tone(props.r)}
      stroke="var(--color-page)"
      strokeWidth={4}
      strokeLinejoin="round"
      style={{ paintOrder: "stroke" }}
      pointerEvents="none"
    >
      {label(props.r)}
    </text>
  );
}

function BoxesCanvas(props: LabCanvasProps): ReactElement {
  const keys = Object.keys(props.boxes) as BoxKey[];
  const overlay = (
    <g>
      {keys.map((k) => {
        const b = props.boxes[k];
        const r = props.results.get(k);
        const v = r?.ok === true && r.value instanceof Vec2 ? r.value : undefined;
        return (
          <g key={k}>
            {v === undefined ? null : (
              <g pointerEvents="none">
                <line x1={b.position.x * UNIT} y1={b.position.y * UNIT} x2={v.x * UNIT} y2={v.y * UNIT} stroke="var(--color-accent)" strokeDasharray="4 3" strokeWidth={1.5} />
                <circle cx={v.x * UNIT} cy={v.y * UNIT} r={5} fill="var(--color-accent)" />
              </g>
            )}
            <Chip x={(b.position.x + b.size.x) * UNIT - 4} y={b.position.y * UNIT - 6} r={r} anchor="end" />
          </g>
        );
      })}
    </g>
  );
  return <SpaceView boxes={props.boxes} origin={props.origin} onSelect={props.onSelect} overlay={overlay} label="The boxes, with the result at each box. Select a box to make it the origin." />;
}

function LifeCanvas(props: LabCanvasProps): ReactElement {
  const C = 34;
  return (
    <svg viewBox={`0 0 ${8 * C} ${8 * C}`} role="group" aria-label="The cells of the grid, with the result at each cell" style={{ width: "100%", maxHeight: "26rem", display: "block" }}>
      {LIFE_ROWS.flatMap((row, i) =>
        row.map((cell, j) => {
          const k = `${i},${j}`;
          const r = props.results.get(k);
          const on = r?.ok === true && r.value === true;
          return (
            <g key={k} onClick={() => props.onSelect(k)} style={{ cursor: "pointer" }} role="button" aria-label={`Cell ${k}${cell.alive ? ", alive" : ""}: ${label(r)}`}>
              <rect x={j * C + 1} y={i * C + 1} width={C - 2} height={C - 2} rx={4} fill={cell.alive ? "var(--color-ink)" : "var(--color-surface)"} stroke={k === props.origin ? "var(--color-mark)" : "var(--color-rule)"} strokeWidth={k === props.origin ? 3 : 1} />
              {r !== undefined && r.ok && typeof r.value === "boolean" ? (
                <circle cx={j * C + C / 2} cy={i * C + C / 2} r={on ? 7 : 3} fill={on ? "var(--color-accent)" : "var(--color-ink-muted)"} opacity={on ? 1 : 0.5} pointerEvents="none" />
              ) : (
                <text x={j * C + C / 2} y={i * C + C / 2 + 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fontWeight={700} fill={cell.alive ? "var(--color-page)" : tone(r)} pointerEvents="none">
                  {label(r)}
                </text>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}

const ORG_POS: Readonly<Record<keyof typeof PEOPLE, { readonly x: number; readonly y: number }>> = {
  ceo: { x: 250, y: 40 },
  cto: { x: 140, y: 130 },
  cfo: { x: 380, y: 130 },
  dev1: { x: 50, y: 220 },
  dev2: { x: 140, y: 220 },
  ops: { x: 230, y: 220 },
  acct: { x: 380, y: 220 },
};

function OrgCanvas(props: LabCanvasProps): ReactElement {
  const keys = Object.keys(PEOPLE) as (keyof typeof PEOPLE)[];
  return (
    <svg viewBox="0 0 470 268" role="group" aria-label="The organization chart, with the result at each person" style={{ width: "100%", maxHeight: "24rem", display: "block" }}>
      {(Object.entries(PARENTS) as [keyof typeof PEOPLE, keyof typeof PEOPLE][]).map(([k, p]) => (
        <line key={k} x1={ORG_POS[p].x} y1={ORG_POS[p].y + 22} x2={ORG_POS[k].x} y2={ORG_POS[k].y - 22} stroke="var(--color-rule-strong)" strokeWidth={1.5} />
      ))}
      {keys.map((k) => {
        const p = ORG_POS[k];
        const r = props.results.get(k);
        return (
          <g key={k} onClick={() => props.onSelect(k)} style={{ cursor: "pointer" }} role="button" aria-label={`${PEOPLE[k].name}, ${PEOPLE[k].role}: ${label(r)}`}>
            <rect x={p.x - 42} y={p.y - 22} width={84} height={44} rx={6} fill="var(--color-surface)" stroke={k === props.origin ? "var(--color-mark)" : "var(--color-rule-strong)"} strokeWidth={k === props.origin ? 3 : 1.5} />
            <text x={p.x} y={p.y - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--color-ink)">
              {PEOPLE[k].name} · {PEOPLE[k].salary}
            </text>
            <Chip x={p.x} y={p.y + 13} r={r} anchor="middle" />
          </g>
        );
      })}
    </svg>
  );
}

function RowsCanvas(props: LabCanvasProps): ReactElement {
  const H = 34;
  const max = Math.max(...ROWS.map((r) => r.v));
  return (
    <svg viewBox={`0 0 420 ${ROWS.length * H + 8}`} role="group" aria-label="The rows, with the result at each row" style={{ width: "100%", maxHeight: "22rem", display: "block" }}>
      {ROWS.map((row, i) => {
        const k = String(i);
        const r = props.results.get(k);
        const w = (row.v / max) * 220;
        return (
          <g key={k} onClick={() => props.onSelect(k)} style={{ cursor: "pointer" }} role="button" aria-label={`Row ${k}, v ${row.v}: ${label(r)}`}>
            <text x={8} y={i * H + 26} fontFamily="var(--font-mono)" fontSize={12} fill="var(--color-ink-muted)">
              {k}
            </text>
            <rect x={28} y={i * H + 8} width={w} height={H - 12} rx={4} fill={k === props.origin ? "var(--color-accent)" : "var(--color-accent-wash)"} stroke="var(--color-accent)" strokeWidth={1.5} />
            <text x={36} y={i * H + 26} fontFamily="var(--font-mono)" fontSize={12} fontWeight={700} fill={k === props.origin ? "var(--color-page)" : "var(--color-ink)"}>
              {row.v}
            </text>
            <Chip x={w + 40} y={i * H + 26} r={r} />
          </g>
        );
      })}
    </svg>
  );
}

/** The canvas of the space of the Lab. */
export function LabCanvas(props: LabCanvasProps): ReactElement {
  switch (props.space) {
    case "boxes":
      return <BoxesCanvas {...props} />;
    case "life":
      return <LifeCanvas {...props} />;
    case "org":
      return <OrgCanvas {...props} />;
    case "rows":
      return <RowsCanvas {...props} />;
  }
}
