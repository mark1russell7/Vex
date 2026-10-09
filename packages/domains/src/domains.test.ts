import { app, evaluate, lit, ref, space, vex, type Result } from "@mark1russell7/vex";
import { describe, expect, it } from "vitest";
import { Angle, AngleDomain } from "./angle.ts";
import { Color } from "./color.ts";
import { LiftedNDVectorDomain, NDVector, NDVectorDomain } from "./ndvector.ts";
import { BoolDomain, NumDomain } from "./scalars.ts";
import { Vec2, Vec2Domain } from "./vec2.ts";

const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code} ${r.error.message}`);
  return r.value;
};
const code = <T>(r: Result<T>): string => (r.ok ? "ok" : r.error.code);

describe("Vec2", () => {
  it("DOMAIN.OWNED: the methods are on the prototype, not on each instance (V-027)", () => {
    const v = new Vec2(1, 2);
    expect(Object.keys(v)).toEqual(["x", "y"]);
    expect(Object.hasOwn(v, "add")).toBe(false);
  });

  it("V-018: division by zero gives #NUM!, not a silent 0", () => {
    const s = space.record({ A: { p: new Vec2(4, 6), z: new Vec2(0, 2) } });
    expect(value(evaluate(app("divide", ref("p"), lit(2)), { space: s, origin: "A", domains: [Vec2Domain] }))).toEqual(new Vec2(2, 3));
    expect(code(evaluate(app("divide", ref("p"), ref("z")), { space: s, origin: "A", domains: [Vec2Domain] }))).toBe("#NUM!");
  });

  it("the geometry ops", () => {
    expect(new Vec2(3, 4).length()).toBe(5);
    expect(new Vec2(1, 0).rotate(Math.PI / 2).x).toBeCloseTo(0, 12);
    expect(new Vec2(0, 0).normalize()).toEqual(Vec2.zero);
    expect(new Vec2(1, 2).cross(new Vec2(3, 4))).toBe(-2);
    expect(new Vec2(1, 3).min(new Vec2(2, 2))).toEqual(new Vec2(1, 2));
  });
});

describe("NDVector", () => {
  it("V-017: a non-finite component stays, and the domain check reports #NUM!", () => {
    const v = new NDVector({ x: 1, y: Number.NaN });
    expect(v.keys()).toEqual(["x", "y"]);
    const s = space.record({ A: { v: new NDVector({ x: 1 }), bad: v } });
    expect(code(evaluate(app("add", ref("v"), ref("bad")), { space: s, origin: "A", domains: [NDVectorDomain] }))).toBe("#NUM!");
  });

  it("V-002: the plain and the lifted domains are independent in one process", () => {
    const s = space.record({ A: { v: new NDVector({ x: 1 }) } });
    const e = app("add", ref("v"), lit(5));
    const plain = evaluate(e, { space: s, origin: "A", domains: [NDVectorDomain] });
    const lifted = evaluate(e, { space: s, origin: "A", domains: [LiftedNDVectorDomain] });
    expect(code(plain)).toBe("#VALUE!");
    expect(value(lifted)).toEqual(new NDVector({ x: 1, scalar: 5 }));
    // The order of the domains in one program decides, and nothing changes between calls.
    expect(code(evaluate(e, { space: s, origin: "A", domains: [NDVectorDomain, LiftedNDVectorDomain] }))).toBe("#VALUE!");
    expect(code(plain)).toBe("#VALUE!");
  });

  it("the typed key algebra: add gives the union of the names", () => {
    const v1 = NDVector.of([["x", 1], ["y", 2]] as const);
    const v2 = NDVector.of([["x", 2], ["z", 5]] as const);
    const sum: NDVector<"x" | "y" | "z"> = v1.scale(3).add(v2);
    expect(sum.toJSON()).toEqual({ x: 5, y: 6, z: 5 });
    expect(v1.dot(v2)).toBe(2);
    expect(new NDVector({ x: 10, y: 20, z: 0 }).pick(["x", "z"]).withKeys(["y"]).toJSON()).toEqual({ x: 10, y: 0 });
  });
});

describe("Color", () => {
  it("V-016: add is commutative, also for the alpha channel", () => {
    const a = new Color(10, 20, 30, 0.5);
    const b = new Color(1, 2, 3, 1);
    expect(a.add(b)).toEqual(b.add(a));
    expect(a.add(Color.none)).toEqual(a);
  });
});

describe("Angle", () => {
  it("toVec2 gives a Vec2, so a chain continues in the Vec2 domain", () => {
    const root = vex(AngleDomain, Vec2Domain, NumDomain).over(space.record({ A: { angle: new Angle(Math.PI / 2) } }));
    const c = root.from("angle")._.toVec2(5)._.length();
    expect(value(c.result("A"))).toBeCloseTo(5, 12);
  });

  it("normalize gives the range from -π to π", () => {
    expect(new Angle(3 * Math.PI).normalize().radians).toBeCloseTo(-Math.PI, 12);
  });
});

describe("Num and Bool", () => {
  it("the scalar ops and their laws", () => {
    const root = vex(NumDomain, BoolDomain).over(space.record({ A: { n: 7, b: true } }));
    expect(value(root.from("n")._.multiply(2)._.gt(10)._.and("b").result("A"))).toBe(true);
    expect(code(root.from("n")._.divide(0).result("A"))).toBe("#NUM!");
  });
});
