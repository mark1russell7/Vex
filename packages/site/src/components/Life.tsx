/**
 * The Game of Life, with a Vex program as the rule. The space is a grid of cells. The neighbors axis with a
 * `where` test counts the live neighbors of a cell, and Bool ops make the rule. Each generation evaluates the
 * rule at each cell: the start axis. Select a cell to change it.
 */
import { space, vex } from "@mark1russell7/vex";
import { BoolDomain, NumDomain } from "@mark1russell7/vex-domains";
import { useEffect, useMemo, useState, type ReactElement } from "react";

type Cell = { readonly alive: boolean };
type Grid = readonly (readonly Cell[])[];

const SIZE = 16;

const glider = (): Grid =>
  Array.from({ length: SIZE }, (_, i) =>
    Array.from({ length: SIZE }, (_cell, j) => ({ alive: [[1, 2], [2, 3], [3, 1], [3, 2], [3, 3], [8, 8], [8, 9], [8, 10]].some(([a, b]) => a === i && b === j) })),
  );

/** This function gives the rule over a grid: the next state of each cell. */
function step(grid: Grid): Grid {
  const g = vex(NumDomain, BoolDomain).over(space.grid(grid));
  const live = g.start(0).neighbors(8, (n) => n.from("alive"), { where: (n) => n.from("alive") }).count();
  const next = live._.eq(3)._.or(g.from("alive")._.and(live._.eq(2)));
  const t = next.all();
  return grid.map((row, i) =>
    row.map((_, j) => {
      const o = t.get(`${i},${j}`);
      return { alive: o.tag === "some" && o.value };
    }),
  );
}

/** The code of the rule, as the reader writes it. */
export const LIFE_CODE = `const g = vex(NumDomain, BoolDomain).over(space.grid(cells));
const live = g.start(0)
  .neighbors(8, (n) => n.from("alive"), { where: (n) => n.from("alive") })
  .count();
const next = live._.eq(3)._.or(g.from("alive")._.and(live._.eq(2)));
next.all();   // the next state of each cell`;

/** The widget. */
export default function Life(): ReactElement {
  const [grid, setGrid] = useState<Grid>(glider);
  const [generation, setGeneration] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      setGrid((g) => step(g));
      setGeneration((n) => n + 1);
    }, 220);
    return () => window.clearInterval(id);
  }, [running]);

  const population = useMemo(() => grid.reduce((s, row) => s + row.filter((c) => c.alive).length, 0), [grid]);

  return (
    <section className="vx-frame" aria-label="The Game of Life with a Vex rule">
      <header>
        <strong>The Game of Life</strong>
        <span className="vx-row">
          <button type="button" className="vx-button" data-variant="primary" onClick={() => setRunning(!running)}>
            {running ? "Stop" : "Start"}
          </button>
          <button
            type="button"
            className="vx-button"
            onClick={() => {
              setGrid(step(grid));
              setGeneration(generation + 1);
            }}
          >
            One generation
          </button>
          <button
            type="button"
            className="vx-button"
            onClick={() => {
              setGrid(glider());
              setGeneration(0);
            }}
          >
            Reset
          </button>
          <span className="vx-muted">
            generation {generation}, {population} live cells
          </span>
        </span>
      </header>
      <div className="graph-paper" style={{ display: "grid", gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 2, padding: 8, maxWidth: 480, margin: "0 auto" }}>
        {grid.map((row, i) =>
          row.map((c, j) => (
            <button
              key={`${i},${j}`}
              type="button"
              aria-label={`Cell ${i},${j}, ${c.alive ? "live" : "dead"}`}
              aria-pressed={c.alive}
              onClick={() => setGrid(grid.map((r, a) => r.map((x, b) => (a === i && b === j ? { alive: !x.alive } : x))))}
              style={{
                aspectRatio: "1",
                border: "1px solid var(--color-rule)",
                borderRadius: 3,
                padding: 0,
                cursor: "pointer",
                background: c.alive ? "var(--color-accent)" : "var(--color-surface)",
              }}
            />
          )),
        )}
      </div>
      <pre className="vx-code">{LIFE_CODE}</pre>
    </section>
  );
}
