/**
 * Each scenario of the 20 tests of `@vex/legacy`, written with the new API. When these pass, the new core
 * covers what the old code did, and the plan can delete `@vex/legacy`.
 */
import { space, vex, type Result } from "@vex/core";
import { describe, expect, it } from "vitest";
import { Angle, AngleDomain } from "./angle.ts";
import { Color, ColorDomain } from "./color.ts";
import { NDVector, NDVectorDomain, NumRecordDomain } from "./ndvector.ts";
import { NumDomain } from "./scalars.ts";
import { Vec2, Vec2Domain } from "./vec2.ts";
import { Fn, FnDomain, Maybe, MaybeDomain } from "./wrappers.ts";

const value = <T>(r: Result<T>): T => {
  if (!r.ok) throw new Error(`${r.error.code} ${r.error.message}`);
  return r.value;
};

describe("parity: locals and optics (dsl.local.spec)", () => {
  const A = { position: new Vec2(1, 2), size: new Vec2(3, 4) };
  const B = { position: new Vec2(5, 6), size: new Vec2(7, 8) };
  const root = vex(Vec2Domain, NumDomain).over(space.record({ A, B }));

  it("a call with a missing argument fails in a strict traversal", () => {
    const loose = vex(Vec2Domain).over(space.record<Record<string, { readonly position: Vec2; readonly rhs?: Vec2 }>>({ A, B }));
    const added = loose.from("position")._.add("rhs").all();
    expect(added.strict().count()).toEqual({ tag: "none" });
  });

  it("a named argument from a field (old: localSetProp + applyUsing)", () => {
    const c = root.from("position").with({ rhs: "size" }, (chain, { rhs }) => chain._.add(rhs));
    expect(value(c.result("A"))).toEqual(new Vec2(4, 6));
  });

  it("a nested path as an argument (old: localSetOptic size.x)", () => {
    const c = root.from("position")._.scale(root.field<number>("size.x"));
    expect(value(c.result("A"))).toEqual(new Vec2(3, 6));
  });

  it("a bound name does not hide a field with the same name", () => {
    const c = root.from("position").with({ position: "size" }, (chain, { position }) => chain._.add(position));
    expect(value(c.result("A"))).toEqual(new Vec2(4, 6));
  });
});

describe("parity: NDVector from fields (dsl.ndv.*)", () => {
  it("fields of the focus (old: localSetNDV)", () => {
    const A = { px: 1, py: 2, pz: 3, base: new NDVector({}) };
    const root = vex(NDVectorDomain, NumRecordDomain).over(space.record({ A }));
    const pos = root.start(root.rec({ x: "px", y: "py", z: "pz" }))._.toNDVector();
    expect(value(root.from("base")._.add(pos).result("A")).toJSON()).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("fields of a peer (old: localSetNDVFromPeer)", () => {
    const A = { base: new NDVector({}) };
    const Biblo = { pos: { x: 10, y: 20, z: 0 } };
    const root = vex(NDVectorDomain, NumRecordDomain).over(space.record({ A, Biblo }));
    const pos = root.start(root.rec({ x: root.ofPath<number>("Biblo", "pos.x"), y: root.ofPath<number>("Biblo", "pos.y"), z: root.ofPath<number>("Biblo", "pos.z") }))._.toNDVector();
    expect(value(root.from("base")._.add(pos).result("A")).toJSON()).toEqual({ x: 10, y: 20, z: 0 });
  });

  it("fields of several peers (old: localSetNDVFromPeers)", () => {
    const A = { base: new NDVector({}) };
    const B1 = { p: { x: 1, z: 7 } };
    const B2 = { p: { y: 2 } };
    const root = vex(NDVectorDomain, NumRecordDomain).over(space.record({ A, B1, B2 }));
    const pos = root.start(root.rec({ x: root.ofPath<number>("B1", "p.x"), y: root.ofPath<number>("B2", "p.y"), z: root.ofPath<number>("B1", "p.z") }))._.toNDVector();
    expect(value(root.from("base")._.add(pos).result("A")).toJSON()).toEqual({ x: 1, y: 2, z: 7 });
  });

  it("the typed key algebra and a chain of scale and add (dsl.ndvector.typed.spec)", () => {
    const A = { v: NDVector.of([["x", 1], ["y", 2]] as const) };
    const rhs = NDVector.of([["x", 2], ["z", 5]] as const);
    const root = vex(NDVectorDomain).over(space.record({ A }));
    expect(value(root.from("v")._.scale(3)._.add(rhs).result("A")).toJSON()).toEqual({ x: 5, y: 6, z: 5 });
  });
});

describe("parity: other domains", () => {
  it("Fn: invoke with arguments (dsl.factory.spec)", () => {
    const root = vex(FnDomain).over(space.record({ A: { f: new Fn((x: number, y: number) => x + y) } }));
    expect(value(root.from("f")._.invoke(7, 5).result("A"))).toBe(12);
  });

  it("Maybe: map and chain with function arguments (dsl.tb.spec)", () => {
    const root = vex(MaybeDomain).over(space.record({ A: { t: Maybe.top(3) } }));
    const doubled = value(root.from("t")._.map(root.lit((x: unknown) => (x as number) * 2)).result("A"));
    expect(doubled.valueOr(0)).toBe(6);
    const gone = value(root.from("t")._.chain(root.lit(() => Maybe.bottom())).result("A"));
    expect(gone.isBottom()).toBe(true);
  });

  it("Color: multiply, add and clamp (dsl.color.spec)", () => {
    const root = vex(ColorDomain).over(space.record({ C: { color: new Color(10, 20, 30) } }));
    const c = value(root.from("color")._.multiply(2)._.add(new Color(5, 5, 5))._.clamp(0, 40).result("C"));
    expect([c.r, c.g, c.b]).toEqual([25, 40, 40]);
  });

  it("a scale factor from a peer record (dsl.color.vector.interop.spec)", () => {
    const A = { color: new Color(30, 40, 0), position: new Vec2(1, 2) };
    const Biblo = { vector: { defaults: { factor: 3 } } };
    const root = vex(Vec2Domain).over(space.record({ A, Biblo }));
    expect(value(root.from("position")._.scale(root.ofPath<number>("Biblo", "vector.defaults.factor")).result("A"))).toEqual(new Vec2(3, 6));
  });

  it("Angle: add and toVec2 (dsl.angle.spec)", () => {
    const A = { angle: new Angle(Math.PI / 4), size: new Vec2(3, 4) };
    const root = vex(AngleDomain, Vec2Domain, NumDomain).over(space.record({ A }));
    expect(value(root.from("angle")._.add("angle").result("A")).radians).toBeCloseTo(Math.PI / 2, 12);
    const v = value(root.from("angle")._.toVec2(5).result("A"));
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(5, 12);
    // The old test passed a vector where a number belongs. The new types reject it, and the run time says #VALUE!.
    // @ts-expect-error -- toVec2 needs a number, and "size" is a Vec2 field
    expect(root.from("angle")._.toVec2("size").result("A")).toMatchObject({ ok: false, error: { code: "#VALUE!" } });
  });

  it("several domains in one chain (dsl.composite.spec: the old DSL could not do this)", () => {
    const items = {
      A: { position: new Vec2(2, 0), angle: new Angle(Math.PI / 2), color: new Color(50, 50, 50) },
      B: { position: new Vec2(0, 3), angle: new Angle(Math.PI / 4), color: new Color(30, 60, 90) },
      C: { position: new Vec2(1, 1), angle: new Angle(0), color: new Color(100, 0, 0) },
    };
    const root = vex(Vec2Domain, AngleDomain, ColorDomain, NumDomain).over(space.record(items));
    // Scale the position by the color factor, rotate it by the angle, and sum the lengths over the start axis.
    const factor = root.from("color")._.luminance()._.divide(50);
    const lengths = root.from("position")._.scale(factor)._.rotate(root.from("angle")._.normalize()._.toVec2(1)._.angle())._.length();
    const total = lengths.all().sum();
    expect(total.tag).toBe("some");
  });
});
