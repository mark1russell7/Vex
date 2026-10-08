/**
 * The golden tests (docs/REVIEW.md §8.2, layer L6). Each test writes the IR and the trace of a program to a file
 * under `__golden__`. A change of the semantics thus shows as a readable diff in review. To accept a change,
 * run `vitest run -u` and commit the new files.
 */
import { describe, expect, it } from "vitest";
import { vex } from "./builder.ts";
import { defineDomain } from "./domain.ts";
import { explain, formatTrace } from "./evaluate.ts";
import { ref, type Expr } from "./ir.ts";
import { space } from "./space.ts";
import type { Trace } from "./trace.ts";
import { Pt, PtDomain } from "./test-support.ts";

const box = (x: number, y: number, w: number, h: number): { readonly position: Pt; readonly size: Pt } => ({
  position: new Pt(x, y),
  size: new Pt(w, h),
});
const A = box(0, 0, 2, 2);
const B = box(3, 4, 1, 1);
const C = box(6, 8, 1, 1);
const D = box(0, 1, 1, 1);

const expectGolden = async (name: string, program: Expr, trace: Trace): Promise<void> => {
  await expect(`${JSON.stringify(program, null, 2)}\n`).toMatchFileSnapshot(`./__golden__/${name}.ir.json`);
  await expect(formatTrace(trace, [PtDomain])).toMatchFileSnapshot(`./__golden__/${name}.trace.txt`);
};

describe("golden traces (TRACE.EVENTS)", () => {
  const pair = vex(PtDomain).over(space.record({ A, B }));
  const four = vex(PtDomain).over(space.record({ A, B, C, D }));
  const loose = vex(PtDomain).over(space.record<Record<string, { readonly position?: Pt; readonly size?: Pt }>>({ A, X: {} }));

  it("EXAMPLE.SEPARATION at A", async () => {
    const c = pair.from("position")._.add("size").other()._.subtract("position")._.anyNonPositive();
    await expectGolden("separation", c.program, c.explain("A"));
  });

  it("EXAMPLE.NEAREST at A", async () => {
    const c = four.from("position").others((e) => e._.subtract("position")._.length()).min();
    await expectGolden("nearest", c.program, c.explain("A"));
  });

  it("EXAMPLE.OFFSETS at A", async () => {
    const c = four.from("position").others((e) => e._.subtract("position")).reduce("add");
    await expectGolden("offsets", c.program, c.explain("A"));
  });

  it("an error value at X: two failed arguments give #ARGS with each cause", async () => {
    const c = loose.from("position")._.add("size").ifError(new Pt(0, 0));
    await expectGolden("args-fallback", c.program, c.explain("X"));
  });
});

describe("formatTrace", () => {
  it("uses the default text when a show function throws", () => {
    const Loud = defineDomain({
      name: "Loud",
      is: (u: unknown): u is Pt => u instanceof Pt,
      show: (): string => {
        throw new Error("no text");
      },
      ops: {},
    });
    const trace = explain(ref("position"), { space: space.record({ A }), origin: "A", domains: [Loud] });
    expect(formatTrace(trace, [Loud])).toBe('position @A = {"x":0,"y":0}\nresult = {"x":0,"y":0}\n');
    expect(formatTrace(trace)).toBe(formatTrace(trace, [Loud]));
  });
});
