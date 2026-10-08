/**
 * The speed lane (docs/REVIEW.md §8.2, layer L10). The nightly workflow runs `vitest bench` and keeps the report.
 * Each test compares a Vex program with the same computation in hand-written TypeScript. The lane only reports:
 * no time limit fails it.
 */
import { test } from "vitest";
import { vex } from "../src/builder.ts";
import { compile, evaluate } from "../src/evaluate.ts";
import { parse, serialize } from "../src/json.ts";
import { space } from "../src/space.ts";
import { Pt, PtDomain } from "../src/test-support.ts";

const N = 60;
const boxes = Object.fromEntries(
  Array.from({ length: N }, (_, i) => [`k${i}`, { position: new Pt((i * 37) % 101, (i * 53) % 97), size: new Pt(1 + (i % 5), 1 + (i % 3)) }]),
);
const keys = Object.keys(boxes);
const root = vex(PtDomain).over(space.record(boxes));
const nearest = root.from("position").others((e) => e._.subtract("position")._.length()).min();
const compiled = compile(nearest.program, { domains: [PtDomain] });

test(`the nearest other box, at each of ${N} keys`, async ({ bench }) => {
  await bench.compare(
    bench("vex: all() of the chain", () => {
      nearest.all();
    }),
    bench("vex: one compiled program, run at each key", () => {
      for (const k of keys) compiled.run({ space: root.space, origin: k });
    }),
    bench("vex: evaluate of the IR", () => {
      for (const k of keys) evaluate(nearest.program, { space: root.space, origin: k, domains: [PtDomain] });
    }),
    bench("hand-written loops", () => {
      for (const k of keys) {
        const p = boxes[k]?.position ?? new Pt(0, 0);
        let best = Number.POSITIVE_INFINITY;
        for (const o of keys) {
          if (o === k) continue;
          const q = boxes[o]?.position ?? new Pt(0, 0);
          best = Math.min(best, p.subtract(q).length());
        }
      }
    }),
  );
});

test("the builder and the JSON form", async ({ bench }) => {
  await bench.compare(
    bench("build the chain", () => {
      root.from("position").others((e) => e._.subtract("position")._.length()).min();
    }),
    bench("serialize and parse the program", () => {
      const text = serialize(nearest.program, [PtDomain]);
      if (text.ok) parse(text.value, [PtDomain]);
    }),
  );
});

const SIZE = 16;
const cells = Array.from({ length: SIZE }, (_row, i) => Array.from({ length: SIZE }, (_cell, j) => ({ alive: (i * 7 + j * 3) % 5 === 0 })));
const grid = vex(PtDomain).over(space.grid(cells));
const liveNeighbors = grid.start(0).neighbors(8, (n) => n.from("alive"), { where: (n) => n.from("alive") }).count();

test(`one step of the Game of Life on a ${SIZE} by ${SIZE} grid`, async ({ bench }) => {
  await bench.compare(
    bench("vex: neighbors(8) with where, then count()", () => {
      liveNeighbors.all();
    }),
    bench("hand-written loops", () => {
      for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
          let n = 0;
          for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) if ((di !== 0 || dj !== 0) && (cells[i + di]?.[j + dj]?.alive ?? false)) n++;
          }
        }
      }
    }),
  );
});
