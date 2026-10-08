import { describe, expect, expectTypeOf, it } from "vitest";
import { vex } from "./builder.ts";
import { defineDomain } from "./domain.ts";
import { offset, other } from "./ir.ts";
import { parse, serialize } from "./json.ts";
import type { Result } from "./result.ts";
import { space } from "./space.ts";
import { error, Pt, PtDomain, value } from "./test-support.ts";

const Num = defineDomain({
  name: "Num",
  is: (u: unknown): u is number => typeof u === "number",
  ops: {
    plus: { fn: (a: number, b: number): number => a + b, params: ["number"] },
  },
});

const A = { position: new Pt(0, 0), size: new Pt(2, 2) };
const B = { position: new Pt(3, 4), size: new Pt(1, 1) };

describe("sheets (SHEET.*)", () => {
  const root = vex(PtDomain, Num).over(space.record({ A, B }));

  it("SHEET.CELL: a formula reads a column at the focus, at a key, or at an address", () => {
    const s = root
      .sheet()
      .column("corner", (r) => r.from("position")._.add("size"))
      .column("toB", (r) => r.start(r.cell("corner"))._.subtract(r.cell("corner", "B")))
      .column("toOther", (r) => r.start(r.cell("corner"))._.subtract(r.cell("corner", [other])));
    expect(value(s.result("A", "corner"))).toEqual(new Pt(2, 2));
    expect(value(s.result("A", "toB"))).toEqual(new Pt(-2, -3));
    expect(value(s.result("B", "toOther"))).toEqual(new Pt(2, 3));
    expectTypeOf(s.result("A", "toB")).toEqualTypeOf<Result<Pt>>();
    expect(s.at("A", "toB")).toEqual({ tag: "some", value: new Pt(-2, -3) });
    expect(s.table().map((row) => [row.key, value(row.cells.toOther)])).toEqual([
      ["A", new Pt(-2, -3)],
      ["B", new Pt(2, 3)],
    ]);
  });

  it("SHEET.CELL: an unknown column gives #NAME?, and an address outside the space gives #REF!", () => {
    const s = root
      .sheet()
      .column("bad", (r) => r.start(r.cell<Pt>("nope")))
      .column("far", (r) => r.start(r.cell<Pt>("bad", "Z" as "A")));
    expect(error(s.result("A", "bad")).code).toBe("#NAME?");
    expect(error(s.result("A", "far")).code).toBe("#REF!");
    const malformed = root
      .sheet()
      .column("odd", (r) => r.start(r.ext<Pt>("vex.cell", { column: 7 })))
      .column("bare", (r) => r.start(r.ext<Pt>("vex.cell")));
    expect(error(malformed.result("A", "odd")).code).toBe("#VALUE!");
    expect(error(malformed.result("A", "bare")).code).toBe("#VALUE!");
    const unknown = malformed.explain("A", "nope" as "odd");
    expect(unknown.events).toEqual([]);
    expect(error(unknown.result).code).toBe("#NAME?");
  });

  it("SHEET.CELL: a sheet keeps the free functions and the extension handlers of the options", () => {
    const withOptions = vex(PtDomain, Num)
      .withOptions({ fns: { half: (n: unknown) => Number(n) / 2 }, extensions: { seven: () => ({ ok: true, value: 7 }) } })
      .over(space.record({ A }));
    const s = withOptions.sheet().column("seven", (r) => r.start(r.ext<number>("seven"))._.plus(r.ext<number>("seven")));
    expect(value(s.result("A", "seven"))).toBe(14);
  });

  it("SHEET.RECURRENCE: a column reads itself at the row above, like a running total", () => {
    const rows = vex(Num).over(space.array(Array.from({ length: 5000 }, (_, i) => ({ v: i + 1 }))));
    const s = rows.sheet().column("total", (r) => r.from("v")._.plus(r.start(r.cell<number>("total", [offset(-1)])).ifError(0)));
    expect(s.table().slice(0, 4).map((row) => value(row.cells.total))).toEqual([1, 3, 6, 10]);
    expect(value(s.result("4999", "total"))).toBe((5000 * 5001) / 2);
  });

  it("SHEET.CYCLE: each cell on a cycle gives #CYCLE!, also a reference to itself and a cycle across keys", () => {
    const s = root
      .sheet()
      .column("self", (r) => r.start(r.cell<Pt>("self")))
      .column("a", (r) => r.start(r.cell<Pt>("b"))._.add("size"))
      .column("b", (r) => r.start(r.cell<Pt>("a"))._.add("size"))
      .column("across", (r) => r.start(r.cell<Pt>("across", [other])));
    for (const c of ["self", "a", "b", "across"] as const) {
      for (const k of ["A", "B"] as const) expect(error(s.result(k, c)).code).toBe("#CYCLE!");
    }
  });

  it("SHEET.ORDER: ifError does not hide a cycle, and the order of the evaluations does not change a result", () => {
    const zero = new Pt(0, 0);
    const s = root
      .sheet()
      .column("a", (r) => r.start(r.cell<Pt>("b")).ifError(zero)._.add(r.start(r.cell<Pt>("c")).ifError(zero)))
      .column("b", (r) => r.start(r.cell<Pt>("a")).ifError(zero))
      .column("c", (r) => r.start(r.cell<Pt>("b")).ifError(new Pt(5, 5)))
      .column("outside", (r) => r.start(r.cell<Pt>("a")).ifError(new Pt(9, 9)));
    for (const c of ["a", "b", "c"] as const) expect(error(s.result("A", c)).code).toBe("#CYCLE!");
    expect(value(s.result("A", "outside"))).toEqual(new Pt(9, 9));
    const codes = s.table().map((row) => Object.values(row.cells).map((r) => (r.ok ? "value" : r.error.code)));
    expect(codes).toEqual([
      ["#CYCLE!", "#CYCLE!", "#CYCLE!", "value"],
      ["#CYCLE!", "#CYCLE!", "#CYCLE!", "value"],
    ]);
  });

  it("SHEET.CELL: the columns are JSON data, and explain shows the cell reads", () => {
    const s = root
      .sheet()
      .column("corner", (r) => r.from("position")._.add("size"))
      .column("twice", (r) => r.start(r.cell("corner"))._.add(r.cell("corner")));
    for (const program of Object.values(s.columns)) {
      const text = value(serialize(program, [PtDomain]));
      expect(value(parse(text, [PtDomain]))).toEqual(program);
    }
    const trace = s.explain("B", "twice");
    expect(value(trace.result)).toEqual(new Pt(8, 10));
    expect(trace.events.filter((e) => e.tag === "ext")).toHaveLength(2);
    expect(s.explain("A", "corner").result.ok).toBe(true);
  });
});
