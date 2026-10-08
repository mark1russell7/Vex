import { describe, expect, it } from "vitest";
import { index, key, offset, origin, other } from "./ir.ts";
import { applyMove, axisTargets, resolveAddr, space } from "./space.ts";
import { error, value } from "./test-support.ts";

describe("spaces", () => {
  it("record: keys in insertion order, get, has", () => {
    const s = space.record({ A: { n: 1 }, B: { n: 2 } });
    expect(s.kind).toBe("record");
    expect(s.keys).toEqual(["A", "B"]);
    expect(s.get("B")).toEqual({ n: 2 });
    expect(s.has("C")).toBe(false);
    expect(s.coords("A")).toBeUndefined();
  });

  it("array: keys are indexes as strings, and the space copies its input", () => {
    const items = [{ n: 1 }, { n: 2 }];
    const s = space.array(items);
    items.push({ n: 3 });
    expect(s.keys).toEqual(["0", "1"]);
    expect(s.get("1")).toEqual({ n: 2 });
    expect(s.has("01")).toBe(false);
    expect(s.has("2")).toBe(false);
  });

  it("grid: keys are row,column and ragged rows have no missing keys", () => {
    const s = space.grid([[1, 2], [3]]);
    expect(s.keys).toEqual(["0,0", "0,1", "1,0"]);
    expect(s.get("1,0")).toBe(3);
    expect(s.has("1,1")).toBe(false);
    expect(s.coords("0,1")).toEqual([0, 1]);
  });
});

describe("moves (NAV.*)", () => {
  const pair = space.record({ A: 1, B: 2 });
  const three = space.record({ A: 1, B: 2, C: 3 });
  const at = { origin: "A", focus: "A" };

  it("NAV.KEY: a key move goes to the key, an unknown key gives #REF! (V-004)", () => {
    expect(value(applyMove(pair, at, key("B")))).toBe("B");
    const e = error(applyMove(pair, at, key("Z")));
    expect(e.code).toBe("#REF!");
    expect(e.kind).toBe("unknown-key");
  });

  it("NAV.OTHER.PAIR: other is valid only in a space with two keys (V-005)", () => {
    expect(value(applyMove(pair, at, other))).toBe("B");
    expect(value(applyMove(pair, { origin: "A", focus: "B" }, other))).toBe("A");
    expect(error(applyMove(three, at, other)).kind).toBe("not-a-pair");
  });

  it("NAV.ORIGIN: origin goes back to the start of the run (V-040)", () => {
    expect(value(resolveAddr(pair, at, [other, origin]))).toBe("A");
  });

  it("NAV.INDEX: index uses the key order", () => {
    expect(value(applyMove(three, at, index(2)))).toBe("C");
    expect(error(applyMove(three, at, index(3))).kind).toBe("out-of-bounds");
    expect(error(applyMove(three, at, index(-1))).kind).toBe("out-of-bounds");
  });

  it("NAV.OFFSET: offsets move in arrays and grids, and give #REF! outside them (V-019)", () => {
    const arr = space.array(["a", "b", "c"]);
    expect(value(applyMove(arr, { origin: "1", focus: "1" }, offset(1)))).toBe("2");
    expect(error(applyMove(arr, { origin: "2", focus: "2" }, offset(1))).kind).toBe("out-of-bounds");
    const grid = space.grid([[1, 2], [3, 4]]);
    expect(value(applyMove(grid, { origin: "0,0", focus: "0,0" }, offset(1, 1)))).toBe("1,1");
    expect(error(applyMove(grid, { origin: "0,0", focus: "0,0" }, offset(1))).kind).toBe("no-offset");
    expect(error(applyMove(pair, at, offset(1))).kind).toBe("no-offset");
  });

  it("NAV.SEQUENCE: moves apply in order, and a failed move fails the address", () => {
    expect(value(resolveAddr(pair, at, [other, other]))).toBe("A");
    expect(error(resolveAddr(three, at, [other, other])).kind).toBe("not-a-pair");
    expect(error(resolveAddr(pair, at, [key("Z"), key("A")])).kind).toBe("unknown-key");
  });
});

describe("axes (AXIS.*)", () => {
  const three = space.record({ A: 1, B: 2, C: 3 });
  const at = { origin: "B", focus: "B" };

  it("AXIS.ALL and AXIS.OTHERS", () => {
    expect(value(axisTargets(three, at, { t: "all" }))).toEqual(["A", "B", "C"]);
    expect(value(axisTargets(three, at, { t: "others" }))).toEqual(["A", "C"]);
  });

  it("AXIS.NEIGHBORS: 4 and 8 neighbors in a grid, #REF! in other spaces", () => {
    const g = space.grid([[0, 1, 2], [3, 4, 5], [6, 7, 8]]);
    const centre = { origin: "1,1", focus: "1,1" };
    expect(value(axisTargets(g, centre, { t: "neighbors", n: 4 }))).toEqual(["0,1", "1,0", "1,2", "2,1"]);
    expect(value(axisTargets(g, centre, { t: "neighbors", n: 8 }))).toHaveLength(8);
    expect(value(axisTargets(g, { origin: "0,0", focus: "0,0" }, { t: "neighbors", n: 8 }))).toEqual(["0,1", "1,0", "1,1"]);
    expect(error(axisTargets(three, at, { t: "neighbors", n: 4 })).kind).toBe("no-grid");
  });
});
