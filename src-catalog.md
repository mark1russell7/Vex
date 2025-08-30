# Source Catalog (TypeScript)

Generated on 2025-08-30T09:49:28.757Z

## Directory structure (src)

```
├── .git/
│   ├── hooks/

│   ├── info/

│   ├── logs/
│   │   └── refs/
│   │       ├── heads/

│   │       └── remotes/
│   │           └── origin/

│   ├── modules/
│   │   └── external/
│   │       ├── Funk/
│   │       │   ├── hooks/

│   │       │   ├── info/

│   │       │   ├── logs/
│   │       │   │   └── refs/
│   │       │   │       ├── heads/

│   │       │   │       └── remotes/
│   │       │   │           └── origin/

│   │       │   ├── objects/
│   │       │   │   ├── info/

│   │       │   │   └── pack/

│   │       │   └── refs/
│   │       │       ├── heads/

│   │       │       ├── remotes/
│   │       │       │   └── origin/

│   │       │       └── tags/

│   │       └── repo/
│   │           ├── hooks/

│   │           ├── info/

│   │           ├── logs/
│   │           │   └── refs/
│   │           │       ├── heads/

│   │           │       └── remotes/
│   │           │           └── origin/

│   │           ├── objects/
│   │           │   ├── info/

│   │           │   └── pack/

│   │           └── refs/
│   │               ├── heads/

│   │               ├── remotes/
│   │               │   └── origin/

│   │               └── tags/

│   ├── objects/
│   │   ├── 03/

│   │   ├── 4d/

│   │   ├── info/

│   │   └── pack/

│   └── refs/
│       ├── heads/

│       ├── remotes/
│       │   └── origin/

│       └── tags/

├── dsl/
│   ├── adapters/
│   │   └── vector.domain.ts
│   ├── chain/
│   │   ├── base.chain.ts
│   │   └── multi.chain.ts
│   ├── domain/
│   │   ├── domain.adapter.ts
│   │   └── domain.expr.ts
│   ├── expr/
│   │   ├── expr.enum.ts
│   │   ├── expr.ir.ts
│   │   └── expr.step.ts
│   ├── scope/
│   │   ├── array.scope.ts
│   │   ├── map.scope.ts
│   │   ├── matrix.scope.ts
│   │   └── scope.ts
│   ├── dsl.factory.ts
│   ├── eval.ts
│   ├── lenses.ts
│   ├── op.meta.ts
│   ├── traversal.ts
│   └── value.enum.ts
├── external/
│   └── Funk/
│       ├── collections/
│       │   ├── collect.ts
│       │   ├── collection.ts
│       │   └── map.unital.ts
│       ├── functional/
│       │   ├── self.ts
│       │   └── sponge.ts
│       ├── guards/
│       │   └── object.guard.ts
│       ├── monads/
│       │   ├── box.canonicalizer.ts
│       │   ├── box.ts
│       │   └── top.ts
│       ├── optional/
│       │   ├── collections/
│       │   │   ├── optional.map.ts
│       │   │   ├── optional.map.unital.ts
│       │   │   └── optional.map.weak.ts
│       │   ├── either.ts
│       │   └── optional.ts
│       ├── references/
│       │   └── entangler.ts
│       ├── cache.ts
│       └── memo.ts
├── math/
│   ├── algebra/
│   │   └── monoid.ts
│   ├── vector/
│   │   ├── vector.ts
│   │   └── vector.types.ts
│   └── math.ts
├── brand.ts
└── optional.utils.ts
```

## Files

### brand.ts

``` ts
// brand.ts
// Generic, reusable branding for ANY type (Vector, ids, enums, etc.)

export const kBrand = Symbol("brand");

export type Brand<Name extends string> = { readonly [kBrand]: Name };
export type Branded<T, Name extends string> = T & Brand<Name>;

// Attach a non-enumerable runtime brand for debugging; erases at type-level into an opaque type.
export function brand<T, Name extends string>(value: T, name: Name): Branded<T, Name> {
    try { Object.defineProperty(value as object, kBrand, { value: name, enumerable: false }); } catch {}
    return value as Branded<T, Name>;
}
export function brandOf(v: unknown): string | undefined {
    try { return (v as any)?.[kBrand] as string | undefined; } catch { return undefined; }
}
export function isBranded<Name extends string>(v: unknown, name: Name): boolean {
    return brandOf(v) === name;
}

// Common opaque aliases you can adopt progressively (no breaking changes required)
export type NodeId   = Branded<string, "NodeId">;
export type EdgeId   = Branded<string, "EdgeId">;
export type LayoutId = Branded<string, "LayoutId">;

export const asNodeId   = (s: string): NodeId   => brand(s, "NodeId");
export const asEdgeId   = (s: string): EdgeId   => brand(s, "EdgeId");
export const asLayoutId = (s: string): LayoutId => brand(s, "LayoutId");

```

### dsl/adapters/vector.domain.ts

``` ts
// vector-domain.ts
import { Monoid } from "../../math/algebra/monoid";
import { arrayChain, mapChain, matrixChain } from "../chain/base.chain";
import { DomainAdapter } from "../domain/domain.adapter";
import { domainExpr } from "../domain/domain.expr";
import { ValueKind } from "../value.enum";
import { annotateOp } from "../op.meta";
import { Vector } from "../../math/vector/vector";

/** Domain adapter for Vector */
export const VectorAdapter: DomainAdapter<Vector> = {
  name: "Vector",
  isInstance: (v: unknown): v is Vector => v instanceof Vector,
  fromScalar: (n: number) => Vector.scalar(n),
  getMethod(self: Vector, name: string) { return (self as any)[name]; },
  methodReturns(name: string) {
    // (optional) make terminals explicit if you want extra checks elsewhere
    if (name.startsWith("any") || name.startsWith("all")) return ValueKind.Boolean;
    if (name === "length" || name === "area" || name === "sum") return ValueKind.Scalar;
    return undefined;
  }
};

/** Optional: attach algebraic metadata directly to methods on the prototype (no registry). */
(function annotateVector() {
  const P = Vector.prototype as any;
  annotateOp(P, "add",       { commutative: true, associative: true, liftScalar: true });
  annotateOp(P, "multiply",  { commutative: true, associative: true, liftScalar: true });
  annotateOp(P, "subtract",  { liftScalar: true });
  annotateOp(P, "divide",    { liftScalar: true });
  annotateOp(P, "clamp",    { /* numeric args; no lift */ });
  // You can also annotate reducers like max/min if you add them as vector-vector ops.
})();

// DSL facade for Vector
export const vectorExpr = () => domainExpr<Vector>();
export const vectorMapChain   = <Obj extends Record<string, any>>(map: Record<string, Obj>) => mapChain<Vector, Obj>(VectorAdapter as any, map);
export const vectorArrayChain = <Obj extends Record<string, any>>(arr: Obj[])              => arrayChain<Vector, Obj>(VectorAdapter as any, arr);
export const vectorMatrixChain= <Obj extends Record<string, any>>(grid: Obj[][])           => matrixChain<Vector, Obj>(VectorAdapter as any, grid);

// Vector monoids (for fold)
export const VectorMonoid = {
  add: (): Monoid<Vector> => ({
    empty: Vector.scalar(0),
    concat: (a, b) => a.add(b),
  }),
};
```

### dsl/chain/base.chain.ts

``` ts
/* ---------------- Focused chains over map/array/matrix ---------------- */

import { type DomainAdapter } from "../domain/domain.adapter";
import { domainExpr, DomainExpr } from "../domain/domain.expr";
import { StepSwitchTo, StepType, type Step } from "../expr/expr.step";
import { type KeysOfType } from "../lenses";
import { type Scope } from "../scope/scope";
import { isFound, none, Optional } from "../../external/Funk/optional/optional";
import { makeTraversal, Traversal } from "../traversal";
import { makeMapScope } from "../scope/map.scope";
import { makeArrayScope } from "../scope/array.scope";
import { makeMatrixScope } from "../scope/matrix.scope";

// Base chain (map/array/matrix share this)
export class BaseChain<Obj, D> {
  protected steps: Step<D>[] = [];
  protected adapter: DomainAdapter<D>;
  protected scope: Scope<D>;

  constructor(adapter: DomainAdapter<D>, scope: Scope<D>) {
    this.adapter = adapter;
    this.scope = scope;
  }

  /** Pick a domain-valued property (typed by schema) */
  prop<P extends KeysOfType<Obj, D>>(name: P & string): this {
    this.steps.push({ t: StepType.Select, prop: name });
    return this;
  }

  /** dynamic domain method calls after .prop(...) */
  get _(): any {
    const self = this;
    return new Proxy({}, {
      get(_t, op: string) {
        return (...args: any[]) => { self.steps.push({ t: StepType.Invoke, op, args: (domainExpr<D>() as any)(op)(...args)._expr['steps'] ? [] : [] }); self.steps[self.steps.length - 1] = { t: StepType.Invoke, op, args: (args as any).map((a: any) => {
          // We need the same normalizeArgs as in core; reuse proxy approach:
          const e = domainExpr<D>(); (e as any)[op](...args); const built = (e as any)._expr as DomainExpr<D>;
          // Replace our last step with the invoke using normalized args:
          const last = (built as any)['steps'][(built as any)['steps'].length - 1] as Step<D>;
          self.steps[self.steps.length - 1] = last;
          return a; }) };
          return self;
        };
      }
    });
  }

  self(keyOrIndex?: string | number) { this.steps.push({ t: StepType.Switch, to: typeof keyOrIndex === "number" ? StepSwitchTo.Index : StepSwitchTo.Self, key: keyOrIndex }); return this; }
  other(keyOrIndex?: string | number) { this.steps.push({ t: StepType.Switch, to: StepSwitchTo.Other, key: keyOrIndex }); return this; }

  /** Evaluate for a given start */
  build(): (start: string | number) => Optional<any> {
    const adapter = this.adapter;
    const scope = this.scope;
    const steps = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);

    return (start: string | number) => {
      if (typeof start === "number") scope.setFocusByIndex(start); else scope.setFocusByKey(String(start));
      // If program begins with 'select', we pass dummy initial; else require explicit .prop(...)
      const hasSelect = steps.some(s => s.t === StepType.Select);
      if (!hasSelect) return none();
      // initial is unneeded; program will immediately select via scope
      return program(none(), scope);
    };
  }

  value(start: string | number): Optional<any> { return this.build()(start); }

  /** Traverse over all starts; optionally map with an expr; returns Traversal */
  traverse<R = any>(expr?: DomainExpr<D> | ReturnType<typeof domainExpr<D>>): Traversal<R extends never ? any : R> {
    const adapter = this.adapter;
    const scope = this.scope;
    const steps = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);
    const keys = scope.keys();

    const mapper = expr ? ((expr as any).__isDomainExpr ? (expr as any)._expr as DomainExpr<D> : (expr as DomainExpr<D>)) : undefined;
    const mapFn = mapper?.build(adapter);

    const out: Optional<any>[] = [];
    for (const k of keys) {
      scope.setFocusByKey(k);
      const base = program(none(), scope);
      out.push(mapFn ? (isFound(base) ? mapFn(base, scope) : base) : base);
    }

    // For reduceBy(op) to work, we must be able to invoke domain methods.
    const invoke = (a: any, op: string, b: any) => {
      const fn = a?.[op];
      return typeof fn === "function" ? fn.call(a, b) : undefined;
    };

    return makeTraversal({ values: out, invoke });
  }

  /** Traverse peers of the current start (call value(start) first to set focus) */
  peers<R = any>(expr?: DomainExpr<D> | ReturnType<typeof domainExpr<D>>): Traversal<R extends never ? any : R> {
    const adapter = this.adapter;
    const scope = this.scope;
    const steps = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);
    const keys = scope.keys();
    const start = scope.currentKey();

    const mapper = expr ? ((expr as any).__isDomainExpr ? (expr as any)._expr as DomainExpr<D> : (expr as DomainExpr<D>)) : undefined;
    const mapFn = mapper?.build(adapter);

    const out: Optional<any>[] = [];
    for (const k of keys) {
      if (k === start) continue;
      scope.setFocusByKey(k);
      const base = program(none(), scope);
      out.push(mapFn ? (isFound(base) ? mapFn(base, scope) : base) : base);
    }

    const invoke = (a: any, op: string, b: any) => {
      const fn = a?.[op];
      return typeof fn === "function" ? fn.call(a, b) : undefined;
    };

    // restore focus
    scope.setFocusByKey(start);

    return makeTraversal({ values: out, invoke });
  }
}

// Factories
export function mapChain<Obj extends Record<string, any>, D>(adapter: DomainAdapter<D>, map: Record<string, Obj>) {
  return new BaseChain<Obj, D>(adapter, makeMapScope(map, adapter));
}
export function arrayChain<Obj extends Record<string, any>, D>(adapter: DomainAdapter<D>, arr: Obj[]) {
  return new BaseChain<Obj, D>(adapter, makeArrayScope(arr, adapter));
}
export function matrixChain<Obj extends Record<string, any>, D>(adapter: DomainAdapter<D>, grid: Obj[][]) {
  return new BaseChain<Obj, D>(adapter, makeMatrixScope(grid, adapter));
}

```

### dsl/chain/multi.chain.ts

``` ts
import { type DomainAdapter } from "../domain/domain.adapter";
import { type DomainExpr, normalizeArgs } from "../domain/domain.expr";
import { evalProgram } from "../eval";
import { StepType, type Step } from "../expr/expr.step";
import { type Scope } from "../scope/scope";

/* ---------------- Multi-branch after fork ---------------- */
export class MultiChain<Obj, D> {
  private branches: DomainExpr<D>[];
  private base: Step<D>[];
  private scope: Scope<D>;
  private adapter: DomainAdapter<D>;
  constructor(adapter: DomainAdapter<D>, scope: Scope<D>, base: Step<D>[], branches: DomainExpr<D>[]) {
    this.adapter = adapter; this.scope = scope; this.base = [...base]; this.branches = branches.map(b => b.copy());
  }
  private pipe(op: string, args: any[]) {
    const refs = normalizeArgs<D>(args);
    this.branches.forEach(b => b._push({ t: StepType.Invoke, op, args: refs }));
    return this;
  }
  add(a: any) { return this.pipe("add", [a]); }
  subtract(a: any) { return this.pipe("subtract", [a]); }
  multiply(a: any) { return this.pipe("multiply", [a]); }
  divide(a: any) { return this.pipe("divide", [a]); }
  floor() { return this.pipe("floor", []); }
  ceil() { return this.pipe("ceil", []); }
  round() { return this.pipe("round", []); }
  negate() { return this.pipe("negate", []); }
  normalize() { return this.pipe("normalize", []); }
  clamp(min: number, max: number) { return this.pipe("clamp", [min, max]); }

  build(): (start: string | number) => any[] {
    const scope = this.scope;
    const base = [...this.base];
    const adapter = this.adapter;
    const fns = this.branches.map(b => b.build(adapter));
    return (start: string | number) => {
      if (typeof start === "number") scope.setFocusByIndex(start);
      else scope.setFocusByKey(String(start));
      const initial = evalProgram(adapter, base, scope.getPropOpt((base.find(s => s.t === "select") as any).prop), scope);
      return fns.map(fn => fn(initial, scope));
    };
  }
  values(start: string | number) { return this.build()(start); }
}
```

### dsl/domain/domain.adapter.ts

``` ts
import { 
  type ValueKind 
} from "../value.enum";

/* ---------------- Domain Adapter ---------------- */
export interface DomainAdapter<D> {
  name: string;
  /** Type guard */
  isInstance(v: unknown): v is D;
  /** Optional scalar → domain lifter (e.g., Vector.scalar). */
  fromScalar?: (n: number) => D;
  /** Get a method by name on an instance of D. */
  getMethod(self: D, name: string): ((...a: any[]) => any) | undefined;
  /** Optional: refine return kinds of particular methods (for typing/validation). */
  methodReturns?(name: string): ValueKind | undefined;
}
```

### dsl/domain/domain.expr.ts

``` ts
import { type DomainAdapter } from "./domain.adapter";
import { evalProgram } from "../eval";
import { type ArgRef } from "../expr/expr.ir";
import { ExpressionType } from "../expr/expr.enum";
import { StepType, type Step } from "../expr/expr.step";
import { type OpMeta } from "../op.meta";
import { type Scope } from "../scope/scope";
import { Optional } from "../../external/Funk/optional/optional";

/* ---------------- Domain Expressions ---------------- */
export class DomainExpr<D, R = any> {
  constructor(private steps: Step<D>[] = []) {}
  _push(step: Step<D>): this { this.steps.push(step); return this; }
  copy(): DomainExpr<D, R> { return new DomainExpr<D, R>([...this.steps]); }
  build(adapter: DomainAdapter<D>) {
    const program = [...this.steps];
    return (initial: Optional<D>, scope?: Scope<D>): Optional<any> =>
      evalProgram(adapter, program, initial, scope);
  }
}

/** Proxy that records *any* method name + args (no per-method boilerplate). */
export function domainExpr<D>() {
  const expr = new DomainExpr<D>();
  const proxy = new Proxy(function () {}, {
    get(_t, prop: string) {
      if (prop === "__isDomainExpr") return true;
      if (prop === "_expr") return expr;
      if (prop === "select") return (p: string) => (expr._push({ t: StepType.Select, prop: p }), proxy);
      if (prop === "identity") return () => proxy;
      return (...args: any[]) => {
        expr._push({ t: StepType.Invoke, op: String(prop), args: normalizeArgs<D>(args) });
        return proxy;
      };
    }
  });
  return proxy as any;
}

export function normalizeArgs<D>(args: any[]): ArgRef<D>[] {
  return args.map(a => {
    if (typeof a === "number") 
    {
      return { t: ExpressionType.ConstS, v: a };
    }
    if (a && (a as any).__isDomainExpr) 
    {
      return { t: ExpressionType.NestedExpr, expr: (a as any)._expr as DomainExpr<D> };
    }
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === "string" && typeof a[1] === "string")
    {
      return { t: ExpressionType.OfRef, key: a[0], prop: a[1] };
    }
    if (typeof a === "string") return { t: ExpressionType.PropRef, name: a };
    {
      return { t: ExpressionType.ConstD, v: a };
    }
  });
}

export function liftArgs<D>(adapter: DomainAdapter<D>, meta: OpMeta | undefined, args: any[]): any[] {
  const lift = meta?.liftScalar;
  if (!lift) return args;
  const liftOne = (a: any) => (typeof a === "number" && adapter.fromScalar ? adapter.fromScalar(a) : a);
  if (lift === true) return args.map(liftOne);
  if (Array.isArray(lift)) return args.map((a, i) => (lift[i] ? liftOne(a) : a));
  return args;
}

export function liftScalars<D>(adapter: DomainAdapter<D>, meta: OpMeta | undefined, args: any[]): any[] {
  const lift = meta?.liftScalar;
  if (!lift) return args;
  const liftOne = (x: any) => (typeof x === "number" && adapter.fromScalar ? adapter.fromScalar(x) : x);
  if (lift === true) return args.map(liftOne);
  if (Array.isArray(lift)) return args.map((x, i) => (lift[i] ? liftOne(x) : x));
  return args;
}


```

### dsl/dsl.factory.ts

``` ts
/* ---------------- Public factory ---------------- */

import { BaseChain } from "./chain/base.chain";
import { type DomainAdapter } from "./domain/domain.adapter";
import { domainExpr } from "./domain/domain.expr";
import { type ArrayLike, type KeysOfType, type MapLike, type MatrixLike } from "../lenses";
import { makeArrayScope } from "./scope/array.scope";
import { makeMapScope } from "./scope/map.scope";
import { makeMatrixScope } from "./scope/matrix.scope";

export function createDSL<D>(adapter: DomainAdapter<D>) {
  return {
    /** Build expressions for this domain. */
    expr: () => domainExpr<D>(),
    /** Map chain with schema typing (provide the object type for strong prop autocompletion). */
    mapChain<Obj extends Record<string, any>>(map: MapLike<Obj>) {
      return new BaseChain<Obj, D>(adapter, makeMapScope<Obj, D>(map, adapter));
    },
    arrayChain<Obj extends Record<string, any>>(arr: ArrayLike<Obj>) {
      return new BaseChain<Obj, D>(adapter, makeArrayScope<Obj, D>(arr, adapter));
    },
    matrixChain<Obj extends Record<string, any>>(grid: MatrixLike<Obj>) {
      return new BaseChain<Obj, D>(adapter, makeMatrixScope<Obj, D>(grid, adapter));
    }
  };
}
```

### dsl/eval.ts

``` ts
import type { DomainAdapter } from "./domain/domain.adapter";
import { liftScalars } from "./domain/domain.expr";
import { ExpressionType } from "./expr/expr.enum";
import type { ArgRef } from "./expr/expr.ir";
import { StepSwitchTo, StepType, type Step } from "./expr/expr.step";
import { isFound, none, Optional, some } from "../external/Funk/optional/optional";
import { type OpMeta, DSL_OP_META } from "./op.meta";
import { sequenceArrayOpt } from "../optional.utils";
import type { Scope } from "./scope/scope";

function evalArg<D>(adapter: DomainAdapter<D>, a: ArgRef<D>, current: Optional<D>, scope?: Scope<D>): Optional<any> {
  switch (a.t) {
    case ExpressionType.ConstD: return some(a.v);
    case ExpressionType.ConstS: return some(a.v);
    case ExpressionType.PropRef:   return scope ? scope.getPropOpt(a.name) : none();
    case ExpressionType.OfRef:     return scope ? scope.getPropOfOpt(a.key, a.prop) : none();
    case ExpressionType.NestedExpr:   return isFound(current) ? a.expr.build(adapter)(current, scope) : none();
    case ExpressionType.Current: return current;
  }
}

export function evalProgram<D>(
  adapter: DomainAdapter<D>,
  steps: Step<D>[],
  initial: Optional<D>,
  scope?: Scope<D>
): Optional<any> {
  // We carry an Optional<any> as the current value.
  let cur: Optional<any> = initial;

  for (const s of steps) {
    if (s.t === StepType.Switch) {
      if (!scope) return none();
      if (s.to === StepSwitchTo.Self) {
        if (typeof s.key === "string") scope.setFocusByKey(s.key);
        else if (typeof s.key === "number") scope.setFocusByIndex(s.key);
      } else if (s.to === StepSwitchTo.Other) {
        if (s.key != null) {
          if (typeof s.key === "string") scope.setFocusByKey(String(s.key));
          else scope.setFocusByIndex(Number(s.key));
        } else scope.setFocusToOther();
      } else if (s.to === StepSwitchTo.Key) scope.setFocusByKey(String(s.key));
      else scope.setFocusByIndex(Number(s.key));
      continue;
    }

    if (s.t === StepType.Select) {
      if (!scope) return none();
      cur = scope.getPropOpt(s.prop);
      continue;
    }

    if (s.t === StepType.Invoke) {
      // If we don't have a domain value, short-circuit
      if (!isFound(cur) || !adapter.isInstance(cur.right)) { cur = none(); continue; }

      const method = adapter.getMethod(cur.right, s.op);
      if (!method) { cur = none(); continue; }
      const meta = (method as any)[DSL_OP_META] as OpMeta | undefined;

      // Evaluate args (they might be Optional)
      const argOpts = s.args.map(a => evalArg(adapter, a, cur as Optional<D>, scope));
      const args = sequenceArrayOpt(argOpts);
      if (!isFound(args)) { cur = none(); continue; }

      const callArgs = liftScalars(adapter, meta, args.right);
      try {
        cur = some(method.apply(cur.right, callArgs));
      } catch {
        cur = none();
      }
      continue;
    }
  }
  return cur;
}
```

### dsl/expr/expr.enum.ts

``` ts

export enum ExpressionType {
  ConstD = "constD",
  ConstS = "constS",
  PropRef = "prop",
  OfRef = "of",
  NestedExpr = "expr",
  Current = "current"
}

```

### dsl/expr/expr.ir.ts

``` ts
import { type DomainExpr } from "../domain/domain.expr";
import { type ExpressionType } from "./expr.enum";
import { type StepType } from "./expr.step";

export type Expression<E extends ExpressionType | StepType, D> = Record<"t", E> & D;

/* ---------------- Expression IR ---------------- */
export type ConstD<D> = Expression<ExpressionType.ConstD, Record<"v", D>>
export type ConstS = Expression<ExpressionType.ConstS, Record<"v", number>>
export type PropRef = Expression<ExpressionType.PropRef, Record<"name", string>>;             // prop on current focus
export type OfRef = Expression<ExpressionType.OfRef, Record<"key", string> & Record<"prop", string>>;    // prop on named peer
export type NestedExpr<D> = Expression<ExpressionType.NestedExpr, Record<"expr", DomainExpr<D, any>>>;
export type Current = Expression<ExpressionType.Current, {}>;
export type ArgRef<D> = ConstD<D> | ConstS | PropRef | OfRef | NestedExpr<D> | Current;


```

### dsl/expr/expr.step.ts

``` ts
import { type Expression, type ArgRef } from "./expr.ir";

export enum StepType {
  Select = "select",
  Switch = "switch",
  Invoke = "invoke"
}

export enum StepSwitchTo {
  Self = "self",
  Other = "other",
  Key = "key",
  Index = "index"
}

export type StepExpression<E extends StepType, D> = Expression<E, D>;


export type StepLoadFromFocus<D> = StepExpression<StepType.Select, Record<"prop", string>>;
export type StepSwitchFocus<D> = StepExpression<StepType.Switch, Record<"to", StepSwitchTo> & Partial<Record<"key", string | number>>>;
export type StepInvoke<D> = StepExpression<StepType.Invoke, Record<"op", string> & Record<"args", ArgRef<D>[]>>;

export type Step<D> = StepLoadFromFocus<D> | StepSwitchFocus<D> | StepInvoke<D>;

```

### dsl/lenses.ts

``` ts
/* ---------------- Lenses / Schema ---------------- */
/** Keys of T whose type extends D. */
export type KeysOfType<T, D> = { [K in keyof T]-?: T[K] extends D ? K : never }[keyof T];

export type MapLike<T> = Record<string, T>;
export type ArrayLike<T> = T[];
export type MatrixLike<T> = T[][];
```

### dsl/op.meta.ts

``` ts

/** Optional metadata on methods of the domain (attached to the prototype). */
export type OpMeta = {
  commutative?: boolean;
  associative?: boolean;
  /** Auto-lift number → domain (e.g., Vector.scalar) for arguments. boolean = all args, tuple = per arg. */
  liftScalar?: boolean | boolean[];
  /** Mark pure to enable memoization (not used below, but handy to have). */
  pure?: boolean;
};

export const DSL_OP_META: unique symbol = Symbol("dsl:op-meta");
export function annotateOp(proto: any, methodName: string, meta: OpMeta) {
  const fn = proto?.[methodName];
  if (typeof fn !== "function") throw new Error(`annotateOp: '${methodName}' is not a function`);
  Object.defineProperty(fn, DSL_OP_META, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: { ...(fn[DSL_OP_META] ?? {}), ...meta } as OpMeta
  });
}
```

### dsl/scope/array.scope.ts

``` ts
import { type DomainAdapter } from "../domain/domain.adapter";
import { makeMapScope } from "./map.scope";
import { type Scope } from "./scope";
// import { Collection } from "../external/Funk/collections/collection"

export function makeArrayScope<Obj, D>(arr: Obj[], adapter: DomainAdapter<D>) : Scope<D> {
  const map: Record<string, Obj> = Object.fromEntries(arr.map((v, i) => [String(i), v]));
  return makeMapScope(map, adapter);
}
```

### dsl/scope/map.scope.ts

``` ts
import { type DomainAdapter } from "../domain/domain.adapter";
import { none, some } from "../../external/Funk/optional/optional";
import { type Scope } from "./scope";

export function makeMapScope<Obj, D>(map: Record<string, Obj>, adapter: DomainAdapter<D>): Scope<D> {
  const keys = Object.keys(map);
  let idx = 0;
  return {
    getPropOpt: (prop) => {
      const item: any = map[keys[idx]];
      const v = item?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    getPropOfOpt: (key, prop) => {
      const item: any = map[key];
      const v = item?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    setFocusByKey: (k) => { const i = keys.indexOf(k); idx = i >= 0 ? i : idx; },
    setFocusByIndex: (i) => { if (i >= 0 && i < keys.length) idx = i; },
    setFocusToOther: () => { if (keys.length === 2) idx = idx ? 0 : 1; },
    currentKey: () => keys[idx],
    keys: () => [...keys]
  };
}
```

### dsl/scope/matrix.scope.ts

``` ts
import { type DomainAdapter } from "../domain/domain.adapter";
import { none, Optional, some } from "../../external/Funk/optional/optional";
import { type MatrixLike } from "../lenses";
import { type Scope } from "./scope";
export function makeMatrixScope<Obj, D>(grid: MatrixLike<Obj>, adapter: DomainAdapter<D>) : Scope<D> {
  const H = grid.length, W = grid[0]?.length ?? 0;
  let i = 0, j = 0;
  const keys = Array.from({ length: H * W }, (_, k) => `${Math.floor(k / W)},${k % W}`);
  return {
    getPropOpt: (prop: string): Optional<D> => {
      const v: any = grid[i]?.[j]?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    getPropOfOpt: (key: string, prop: string): Optional<D> => {
      const [ii, jj] = key.split(",").map(Number);
      const v: any = grid[ii]?.[jj]?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    setFocusByKey: (k: string) => { [i, j] = k.split(",").map(Number) as any; },
    setFocusByIndex: (n: number) => { i = Math.floor(n / W); j = n % W; },
    setFocusToOther: () => { /* ambiguous on matrix → no-op */ },
    currentKey: () => `${i},${j}`,
    keys: () => keys,
  } as Scope<D>;
}
```

### dsl/scope/scope.ts

``` ts
import { Optional } from "../../external/Funk/optional/optional";

/* ---------------- Scope abstraction ---------------- */
export interface Scope<D> {
  getPropOpt(prop: string): Optional<D>;
  getPropOfOpt(key: string, prop: string): Optional<D>;
  setFocusByKey(key: string): void;
  setFocusByIndex(index: number): void;
  setFocusToOther(): void;
  currentKey(): string;
  keys(): string[];
}

```

### dsl/traversal.ts

``` ts
// dsl/traversal.ts
import { Optional, isFound, none } from "../external/Funk/optional/optional";
import { reduceWithMonoidOpt } from "../optional.utils";
import { Monoid } from "../math/algebra/monoid";

export type Traversal<A> = {
  results: () => Optional<A>[];
  map: <B>(f: (a: A) => B) => Traversal<B>;
  compact: () => Traversal<NonNullable<A>>; // drop none and undefined
  // Booleans
  any: (f?: (a: A) => boolean) => boolean;
  all: (f?: (a: A) => boolean) => boolean;
  none: (f?: (a: A) => boolean) => boolean;
  // Numbers
  sum: (f?: (a: A) => number) => number;
  min: (f?: (a: A) => number) => number | undefined;
  max: (f?: (a: A) => number) => number | undefined;
  // Monoids
  fold: <M>(M: Monoid<M>, f: (a: A) => M) => Optional<M>;
  // Domain reduction by method name
  reduceBy: (op: string) => Optional<A>;
};

export function makeTraversal<A>(opts: { values: Optional<A>[]; invoke?: (a: A, op: string, b: A) => A | undefined }): Traversal<A> {
  const xs = opts.values;

  const toArray = (): A[] => xs.filter(isFound).map(o => (o as any).right as A);

  return {
    results: () => xs,
    map: f => makeTraversal<A>({ values: xs.map(o => (isFound(o) ? ( { tag: 'Right', right: f((o as any).right) } as any ) : o )) as Optional<A>[] , invoke: opts.invoke }),
    compact: () => makeTraversal<NonNullable<A>>({ values: xs.filter(isFound).map(o => (o as any)) }),

    any: (f?: (a: A) => boolean) => {
      const arr = toArray();
      return f ? arr.some(f) : arr.some(Boolean as any);
    },
    all: (f?: (a: A) => boolean) => {
      const arr = toArray();
      return arr.length === 0 ? true : (f ? arr.every(f) : arr.every(Boolean as any));
    },
    none: (f?: (a: A) => boolean) => {
      const arr = toArray();
      return f ? arr.every(a => !f(a)) : arr.every(a => !a);
    },

    sum: (f?: (a: A) => number) => {
      const arr = toArray();
      const g = f ?? ((a: any) => a as number);
      return arr.reduce((s, a) => s + g(a), 0);
    },
    min: (f?: (a: A) => number) => {
      const arr = toArray().map(f ?? ((a: any) => a as number));
      return arr.length ? Math.min(...arr) : undefined;
    },
    max: (f?: (a: A) => number) => {
      const arr = toArray().map(f ?? ((a: any) => a as number));
      return arr.length ? Math.max(...arr) : undefined;
    },

    fold: (M, f) => reduceWithMonoidOpt(xs.map(o => isFound(o) ? ({ tag: 'Right', right: f((o as any).right) } as any) : o), M),

    reduceBy: (op: string) => {
      const arr = toArray();
      if (!arr.length) return none<A>();
      if (!opts.invoke) return none<A>();
      let acc = arr[0];
      for (let i = 1; i < arr.length; i++) {
        const next = opts.invoke(acc, op, arr[i]);
        if (next === undefined) return none<A>();
        acc = next;
      }
      return { tag: 'Right', right: acc } as any;
    }
  };
}

```

### dsl/value.enum.ts

``` ts
export enum ValueKind {
  Domain = "domain",
  Scalar = "scalar",
  Boolean = "boolean",
  Unknown = "unknown",
}
```

### external/Funk/cache.ts

``` ts

import { UnitalOptionalMap } from "./optional/collections/optional.map.unital";
import { Optional } from "./optional/optional"

export const cache = <K, V>(store : UnitalOptionalMap<K, V>) => {
    const hit   = (key : K) : Optional<V> => store.get(key);
    const probe = (key : K) : boolean => store.has(key);
    const cache = (key : K, value : Optional<V>) : void => void store.set(key, value);
    const aside = (lookup : K, value : Optional<V>) : Optional<V> => {
        if (!probe(lookup)) {
            cache(lookup, value); // want to provide a transform func as input to the outer hof
        }
        return hit(lookup);
    }
    return {
        // hit,
        // probe,
        // cache,
        aside
    };
}
```

### external/Funk/collections/collect.ts

``` ts
import { Collection } from "./collection";
import { CollectionType } from "./collection";

export const collect = <T>(iterable: CollectionType<T>): Collection<T, CollectionType<T>> => new Collection<T, CollectionType<T>>(iterable);

```

### external/Funk/collections/collection.ts

``` ts
import { orElseThrow } from "../optional/either";
import { isFound, none, Optional, some } from "../optional/optional";
export type CollectionType<T> = T[] | Set<T>;

export class Collection<T, I extends CollectionType<T> = CollectionType<T>> {
    constructor(private iterable : I) { }
    map<K>(f : (value : T) => K) : Collection<K, Set<K>> {
        let newSet = new Set<K>();
        for (let v of this.iterable) newSet.add(f(v));
        return new Collection<K, Set<K>>(newSet);
    }
    forEach(f : (value : T) => void) : void {
        for (let v of this.iterable) f(v);
    }
    reduce<K>(f : (total : K, value : T) => K, initial : K) : K {
        let total = initial;
        for (let v of this.iterable) total = f(total, v);
        return total;
    }
    filter(f : (value : T) => boolean) : Collection<T, Set<T>> {
        let newSet = new Set<T>();
        for (let v of this.iterable) if (f(v)) newSet.add(v);
        return new Collection<T, Set<T>>(newSet);
    }
    every(f : (value : T) => boolean) : boolean {
        for (let v of this.iterable) if (!f(v)) return false;
        return true;
    }
    some(f : (value : T) => boolean) : boolean {
        for (let v of this.iterable) if (f(v)) return true;
        return false;
    }
    without(set : Set<T>) : Collection<T, Set<T>> {
        return this.filter((value : T) => !set.has(value));
    }
    add(value : T) : void {
        if (this.isSet()) {
            this.iterable.add(value);
        } else if (this.isArray()) {
            this.iterable.push(value);
        } else {
            throw new Error('Unsupported iterable type');
        }
    }
    delete(value : T) : void {
        if (this.isSet()) {
            this.iterable.delete(value);
        } else if (this.isArray()) {
            const index = this.iterable.indexOf(value);
            if (index !== -1) this.iterable.splice(index, 1);
        } else {
            throw new Error('Unsupported iterable type');
        }
    }
    private isSet() : this is Collection<T, Set<T>> {
        return this.iterable instanceof Set;
    }
    private isArray() : this is Collection<T, Array<T>> {
        return Array.isArray(this.iterable);
    }
    has(value : T) : boolean {
        if (this.isSet()) {
            return this.iterable.has(value);
        } else if (this.isArray()) {
            return this.iterable.includes(value);
        } else {
            throw new Error('Unsupported iterable type');
        }
    }
    clone() : Collection<T, I> {
        if (this.isSet()) {
            return new Collection<T, Set<T>>(new Set(this.iterable)) as Collection<T, I>;
        } else if (this.isArray()) {
            return new Collection<T, Array<T>>([...this.iterable]) as Collection<T, I>;
        } else {
            throw new Error('Unsupported iterable type for cloning');
        }
    }
    isNestedIterable<K>() : this is Collection<Collection<K, CollectionType<K>>, CollectionType<Collection<K, CollectionType<K>>>> {
        this.forEach((item : T) => { 
            if (!(item instanceof Collection)) {
                throw new Error('Expected nested iterable, but found flat iterable.');
            }
        });
        return true;
    }
    flatten<K>() : Collection<K, Set<K>> {
        let newSet = new Set<K>();
        if(!this.isNestedIterable<K>()) {
            throw new Error('Expected nested iterable, but found flat iterable.');
        }
        this.forEach((iterable : Collection<K, CollectionType<K>>) => iterable.forEach((item : K) => newSet.add(item)));
        return new Collection<K, Set<K>>(newSet);
    }
    pour(set : Collection<T>) : this {
        for (let v of this.iterable) set.add(v);
        return this;
    }
    getOnlyElement() : T {
        let result : Optional<T> = none();
        for (let v of this.iterable) {
            if (isFound<T>(result)) {
                throw new Error('Expected only one element, but found more than one.');
            }
            result = some(v);
        }
        return orElseThrow(result, () => new Error('Expected one element, but found none.'));
    }
    size() : number {
        if (this.isSet()) return this.iterable.size;
        if (this.isArray()) return this.iterable.length;
        throw new Error('Unsupported iterable type');
    }
    end() : I {
        return this.iterable;
    }
    [Symbol.iterator]() : IterableIterator<T> {
        return this.iterable[Symbol.iterator]();
    }
}



```

### external/Funk/collections/map.unital.ts

``` ts
export interface UnitalMap<K, V> {
    delete(key: K) : boolean;
    get   (key: K) : V;
    has   (key: K) : boolean;
    set   (key: K, value: V) : this;
};
```

### external/Funk/functional/self.ts

``` ts
export const self = <T>(x : T) : T => x;
```

### external/Funk/functional/sponge.ts

``` ts
export const sponge = <Pores extends object, Result>(
    pores   : Pores, 
    squeeze : (filled : Pores) => Result
  ) => {
  const sponge : Partial<Pores> = {};
  const absorb = (water : Partial<Pores>) => {
    soak(water);
    return full() 
            ? squeeze(sponge as Pores) 
            : absorb;
  }
  const soak      = (water : Partial<Pores>) => Object.assign(sponge, water);
  const filled    = (pore  : string        ) => pore in sponge;
  const full = () => 
    Object
      .keys (pores)
      .every(filled);
  return absorb;
}
```

### external/Funk/guards/object.guard.ts

``` ts
export const isObject = (value: unknown): value is object => value !== null && typeof value === 'object';
```

### external/Funk/memo.ts

``` ts
// export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
//     const cache = new Map<string, ReturnType<T>>();
//     return ((...args: Parameters<T>): ReturnType<T> => {
//         const key = JSON.stringify(args);
//         if (cache.has(key)) {
//         return cache.get(key)!;
//         }
//         const result = fn(...args);
//         cache.set(key, result);
//         return result;
//     }) as T;
//     }

```

### external/Funk/monads/box.canonicalizer.ts

``` ts
import { cache } from "../cache";
import { isObject } from "../guards/object.guard";
import { box, Box, isBoxed } from "./box";

// const {
//   hit,
//   probe,
//   cache,
//   aside
// } = cache(new WeakMap<object, Box<any>>())

const cannon  = new WeakMap<object, Box<any>>();
export function canonicalize<T>(value: T | Box<T>): Box<T> {
  if (isBoxed (value)) return value;
  if (isObject(value)) {
    if (!cannon.has(value)) 
      cannon.set(value, box(value));
    return cannon.get(value)!;
  }
  // for primitives, just wrap fresh each time
  return box(value);
}

```

### external/Funk/monads/box.ts

``` ts
// export class Box<T> {
//     constructor(public readonly value: T) { }
// }

import { isObject } from "../guards/object.guard";

// const BOX = Symbol('box');

// type BoxedPrimitive<T> = { value : T };
// type BoxBrand = Record<typeof BOX, true>;
// type Boxable<T> = object | BoxedPrimitive<T>;
// export type Box<T> = Boxable<T> & BoxBrand;

// const boxPrimitive = <T>(value: T): BoxedPrimitive<T> => ({ value });

// const isObject = (value: any): value is object => value !== null && typeof value === 'object';

// const coerceToBoxable = <T>(value: T) : Boxable<T> => {
//     if (isObject(value)) {
//         return value;
//     } else {
//         return boxPrimitive(value);
//     }
// }

// export function box<T extends object | number | string | boolean>(value : T) : Box<T> {
//     if (!Object.isExtensible(value)) {
//         throw new Error("Cannot box a non-extensible object");
//     }      
//     const boxable = coerceToBoxable(value);
//     Object.defineProperty(boxable, BOX, {
//         value: true
//     });
//     return boxable as Box<T>;
// }
// export function isBoxed<T>(value: any): value is Box<T> {
//     return isObject(value) && BOX in value && value[BOX] === true;
// }

        const   BOX     = Symbol('box');
export  type    Box<T>  = Record<typeof BOX, T>;
export  const   box     = <T>(value : T     )   : Box<T>            => ({[BOX]: value});
export  const   unbox   = <T>(box   : Box<T>)   : T                 => box[BOX];
export  const   isBoxed =    (value : any   )   : value is Box<any> => isObject(value) && BOX in value;
```

### external/Funk/monads/top.ts

``` ts
import { none, NotFound, Optional, TNotFound } from "../optional/optional";

enum Types {
    Top = 'Top',
    Bottom = 'Bottom',
    None = 'None',
    Some = 'Some',
    Number = 'Number',
    String = 'String',
    Boolean = 'Boolean',
    Collection = 'Collection',
    Object = 'Object',
    Function = 'Function',
    Optional = 'Optional'
}

export class Top<T> {
    constructor(
        private readonly value : T,
        private readonly type : Types = Types.Top 
    )
    {}
}

```

### external/Funk/optional/collections/optional.map.ts

``` ts
import { none, Optional } from "../optional";
import { UnitalOptionalMap } from "./optional.map.unital";

export  class      OptionalMap      <K, V          > 
        extends    Map              <K, Optional<V>> 
        implements UnitalOptionalMap<K, V          >
{
    get(key: K): Optional<V> 
    {
        return super.get(key) ?? none<V>();
    }
}

// export const getOrNone = <K,V>(m: Map<K,V>, k:K): Optional<V> =>
//     m.has(k) ? some(m.get(k)!) : none();
```

### external/Funk/optional/collections/optional.map.unital.ts

``` ts
import { UnitalMap } from "../../collections/map.unital";
import { Optional } from "../optional";

export interface UnitalOptionalMap<K, V> extends UnitalMap<K, Optional<V>> {}
```

### external/Funk/optional/collections/optional.map.weak.ts

``` ts
import { Optional, none } from "../optional";
import { UnitalOptionalMap } from "./optional.map.unital";

export  class      OptionalWeakMap  <K extends object, V          > 
        extends    WeakMap          <K               , Optional<V>>
        implements UnitalOptionalMap<K               , V          > 
{
  public get(key : K) : Optional<V> 
  {
    return super.get(key) ?? none<V>();
  }
}
```

### external/Funk/optional/either.ts

``` ts
export type Either<L,R>
  = { tag : 'Left' ; left  : L }
  | { tag : 'Right'; right : R };

export const left  = <L, R = never>(l : L) : Either<L,R> => ({ tag : 'Left' , left  : l });
export const right = <R, L = never>(r : R) : Either<L,R> => ({ tag : 'Right', right : r });

export const isLeft  = <L, R>(e : Either<L, R>) : e is { tag : 'Left' ; left  : L } => e.tag === 'Left';
export const isRight = <L, R>(e : Either<L, R>) : e is { tag : 'Right'; right : R } => e.tag === 'Right';



export const getOrElse = <L, R>(e : Either<L, R>, defaultVal : R) : R => isRight(e) ? e.right : defaultVal;
export const orElse = <L, R>(e : Either<L, R>, f : (l : L) => R) : R => isRight(e) ? e.right : f(e.left);
export const orElseThrow = <L, R, E extends Error>(e : Either<L, R>, errorFn : (l : L) => E) : R => isRight(e) ? e.right : (() => { throw errorFn(e.left); })();

export const fold = <L, R, T>(
  e : Either<L, R>,
  onLeft  : (l : L) => T,
  onRight : (r : R) => T
) : T => 
  e.tag === 'Right'
    ? onRight(e.right)
    : onLeft (e.left);

export const map = <L, R, LL, RR>(
  e : Either<L, R>,
  fnLeft : (l : L) => LL, 
  fnRight : (r : R) => RR
) : Either<LL, RR> =>
  e.tag === 'Right'
    ? right(fnRight(e.right))
    : left(fnLeft(e.left));

export const mapLeft = <L, R, LL>(
  e : Either<L, R>,
  f : (l : L) => LL
) : Either<LL, R> => 
  e.tag === 'Left'
    ? left(f(e.left))
    : e;

export const mapRight = <L, R, RR>(
  e : Either<L, R>,
  f : (r : R) => RR
) : Either<L, RR> => 
  e.tag === 'Right'
    ? right(f(e.right))
    : e;

export const chain = <L, R, RR>(
  e : Either<L, R>,
  f : (r : R) => Either<L, RR>
) : Either<L, RR> => 
  e.tag === 'Right'
    ? f(e.right)
    : e;

export function tapLeft<L, R>(e : Either<L, R>, fn : (l : L) => void) : Either<L, R> {
  if (isLeft(e)) {
    fn(e.left);
  }
  return e;
}
export function tapRight<L, R>(e : Either<L, R>, fn : (r : R) => void) : Either<L, R> {
  if (isRight(e)) {
    fn(e.right);
  }
  return e;
}
export function tap<L, R>(e : Either<L, R>, fnLeft : (l : L) => void, fnRight : (r : R) => void) : Either<L, R> {
  if (isLeft(e)) {
    fnLeft(e.left);
  } else {
    fnRight(e.right);
  }
  return e;
}

```

### external/Funk/optional/optional.ts

``` ts
import { Either, isRight, left, right } from "./either";

export const NotFound: unique symbol = Symbol('NotFound');
export type TNotFound = typeof NotFound;

export type Optional<T> = Either<TNotFound, T>;

export const none       = <T>()      : Optional<T> => left<TNotFound>(NotFound);
export const some       = <T>(v : T) : Optional<T> => right<T>(v);

export const isFound    = <T>(o : Optional<T>)    : o is Either<never, T> => isRight(o);
export const isDefined  = <T>(o : T | undefined)  : o is T                => o !== undefined;

export const nullable   = <T>(o : T | undefined) : Optional<T> => isDefined(o) 
                                                                    ? some(o) 
                                                                    : none<T>();
```

### external/Funk/references/entangler.ts

``` ts
import { Collection } from "../collections/collection";
import { OptionalMap } from "../optional/collections/optional.map";
import { OptionalWeakMap } from "../optional/collections/optional.map.weak";
import { orElseThrow } from "../optional/either";

export abstract class Entangler<T, B> {
  protected readonly bindings = new OptionalMap<T, B>();

  /** public API: tear down whatever this mode defines, then rebuild */
  public entangle(set: Collection<T>): void {
    this.unbind(set);
    this.bind(set);
  }

  /** lookup-or-throw for whatever B is in this mode */
  public dereference(key: T): B {
    return orElseThrow(this.bindings.get(key), () => new Error(`No entanglement for ${key}`));
  }

  /** “how do I tear down old bindings for this set?” */
  protected abstract unbind(set: Collection<T>): void;

  /** “how do I build new bindings for this set?” */
  protected abstract bind(set: Collection<T>): void;
}

```

### math/algebra/monoid.ts

``` ts
// algebra/monoid.ts
export interface Semigroup<T> { concat: (a: T, b: T) => T; }
export interface Monoid<T> extends Semigroup<T> { empty: T; }

export const Monoid = {
  first<T>(): Monoid<T | undefined> {
    return { empty: undefined, concat: (a, b) => (a !== undefined ? a : b) };
  },
  all(): Monoid<boolean> {
    return { empty: true, concat: (a, b) => a && b };
  },
  any(): Monoid<boolean> {
    return { empty: false, concat: (a, b) => a || b };
  },
  sum(): Monoid<number> {
    return { empty: 0, concat: (a, b) => a + b };
  },
  product(): Monoid<number> {
    return { empty: 1, concat: (a, b) => a * b };
  },
};

```

### math/math.ts

``` ts

/* ---------- Functional helpers ---------- */
export const ceilSqrt = (n: number): number => Math.ceil(Math.sqrt(Math.max(1, n)));
export const add = (a: number, b: number): number => a + b;
export const subtract = (a: number, b: number): number => a - b;
export const multiply = (a: number, b: number): number => a * b;
export const divide = (a: number, b: number): number => a / b;

```

### math/vector/vector.ts

``` ts
import { type VectorBrand, Dimension, type Fold, type Reduce, type NestFold, type FoldWith } from "./vector.types";
import { type Branded, brand } from "../../brand";
import { add, multiply, subtract } from "../math";


export class Vector {


  static scalar = (scalar: number) => new Vector(scalar, scalar);
  static conjugate = (v1: Vector, v2: Vector) => [new Vector(v1.x, v2.x), new Vector(v1.y, v2.y)];
  // static circumscribedRectangle = (p1 : Vector, p2 : Vector) => new Shapes.Rectangle
  public traverseGridTo = (target: Vector, visit: (p: Vector) => void) => {
    for (let x = this.x; x <= target.x; x++) {
      for (let y = this.y; y <= target.y; y++) {
        visit(new Vector(x, y));
      }
    }
  };

  constructor(public readonly x: number, public readonly y: number) { }

  public as<B extends VectorBrand>(b: B): Branded<Vector, B> { return brand(this, b); }
  public asPosition() { return this.as("Position"); }
  public asSize() { return this.as("Size"); }
  public asOffset() { return this.as("Offset"); }
  public asCenter() { return this.as("Center"); }


  public some = (predicate: (value: number) => boolean) => this.reduce<boolean>((x, y) => predicate(x) || predicate(y));
  public every = (predicate: (value: number) => boolean) => this.reduce<boolean>((x, y) => predicate(x) && predicate(y));
  public and = this.every;
  public or = this.some;

  public allLessThan = (value: number) => this.every((x) => x < value);
  public anyLessThan = (value: number) => this.some((x) => x < value);
  public allLessEqual = (value: number) => this.every((x) => x <= value);
  public anyLessEqual = (value: number) => this.some((x) => x <= value);
  public allGreaterThan = (value: number) => this.every((x) => x > value);
  public anyGreaterThan = (value: number) => this.some((x) => x > value);
  public allGreaterEqual = (value: number) => this.every((x) => x >= value);
  public anyGreaterEqual = (value: number) => this.some((x) => x >= value);
  public allEqual = (value: number) => this.every((x) => x === value);
  public anyEqual = (value: number) => this.some((x) => x === value);
  public allPositive = () => this.every((x) => x > 0);
  public anyPositive = () => this.some((x) => x > 0);
  public allNegative = () => this.every((x) => x < 0);
  public anyNegative = () => this.some((x) => x < 0);
  public allZero = () => this.every((x) => x === 0);
  public anyZero = () => this.some((x) => x === 0);
  public allNonZero = () => this.every((x) => x !== 0);
  public anyNonZero = () => this.some((x) => x !== 0);
  public allNonNegative = () => this.every((x) => x >= 0);
  public anyNonNegative = () => this.some((x) => x >= 0);
  public allNonPositive = () => this.every((x) => x <= 0);
  public anyNonPositive = () => this.some((x) => x <= 0);


  public reflect = (axis: Dimension) => (axis === Dimension.X ? new Vector(this.x, -this.y) : new Vector(-this.x, this.y));
  public scale = (factor: number) => this.multiply(Vector.scalar(factor));
  public sum = () => this.reduce(add);
  public crossProduct = (vector: Vector) => this.reflect(Dimension.X).dotProduct(vector.swap());

  /** Safe normalize (guards zero-length). */
  public normalize = (eps = 1e-6) => {
    const len = this.length();
    return len > eps ? this.scale(1 / len) : new Vector(0, 0);
  };

  public length = () => Math.sqrt(this.dotProduct(this));
  public round = () => this.map(Math.round);
  public ceil = () => this.map(Math.ceil);
  public floor = () => this.map(Math.floor);
  public map = (f: Fold) => this.fold(f, f);
  public reduce = <T>(f: Reduce<T>) => f(this.x, this.y);
  public trig = () => this.fold(Math.cos, Math.sin);
  public swap = () => new Vector(this.y, this.x);
  public area = () => this.reduce(multiply);

  /** Safe aspect ratio (y=0 → Infinity). */
  public aspectRatio = () => (this.y === 0 ? Infinity : this.x / this.y);

  public add = (vector: Vector) => this.mapWith(add, vector);
  public multiply = (vector: Vector) => this.mapWith(multiply, vector);
  /** Safe component-wise divide (0 divisor → 0). */
  public divide = (vector: Vector) => new Vector(vector.x === 0 ? 0 : this.x / vector.x, vector.y === 0 ? 0 : this.y / vector.y);

  public subtract = (vector: Vector) => this.mapWith(subtract, vector);
  public max = () => this.reduce(Math.max);
  public min = () => this.reduce(Math.min);
  public negate = () => this.scale(-1);
  public halve = () => this.scale(1 / 2);
  public dotProduct = (vector: Vector) => this.multiply(vector).sum();
  public rotate = (radians: number) => Vector.scalar(radians)
    .trig()
    .nestFold(
      (v: Vector) => v.reflect(Dimension.X).multiply(this).sum(),
      (v: Vector) => v.swap().multiply(this).sum()
    );
  public clamp = (min: number = -Infinity, max: number = Infinity) => this.map((x: number) => Math.min(Math.max(x, min), max));
  public nestFold = (left: NestFold, right: NestFold) => new Vector(left(this), right(this));
  public mapWith = (f: FoldWith, vector: Vector) => this.foldWith(f, f, vector);
  public foldWith = (left: FoldWith, right: FoldWith, vector: Vector) => new Vector(left(this.x, vector.x), right(this.y, vector.y));
  public fold = (left: Fold, right: Fold) => new Vector(left(this.x), right(this.y));
}

```

### math/vector/vector.types.ts

``` ts
import { Vector } from "./vector";


export type VectorBrand = "Any" | "Position" | "Size" | "Offset" | "Center";
export enum Dimension { X = "x", Y = "y" }

export type Fold = (value: number) => number;
export type NestFold = (vector: Vector) => number;
export type FoldWith = (value1: number, value2: number) => number;
export type Reduce<T = number> = (x: number, y: number) => T;

```

### optional.utils.ts

``` ts
// optional/utils.ts
import { Optional, isFound, none, some } from "./external/Funk/optional/optional";

export const mapOpt = <A, B>(oa: Optional<A>, f: (a: A) => B): Optional<B> =>
  isFound(oa) ? some(f(oa.right)) : none<B>();

export const chainOpt = <A, B>(oa: Optional<A>, f: (a: A) => Optional<B>): Optional<B> =>
  isFound(oa) ? f(oa.right) : none<B>();

export const apOpt = <A, B>(of: Optional<(a: A) => B>, oa: Optional<A>): Optional<B> =>
  isFound(of) && isFound(oa) ? some(of.right(oa.right)) : none<B>();

export const sequenceArrayOpt = <A>(xs: Optional<A>[]): Optional<A[]> => {
  const out: A[] = [];
  for (const o of xs) { if (!isFound(o)) return none<A[]>(); out.push(o.right); }
  return some(out);
};

// Reduce helpers on arrays of Optional
export function reduceWithMonoidOpt<T>(xs: Optional<T>[], M: { empty: T; concat: (a: T, b: T) => T }): Optional<T> {
  let acc: T | undefined;
  for (const o of xs) {
    if (!isFound(o)) continue; // ignore missing by default; tweak if you prefer "none if any none"
    acc = acc === undefined ? o.right : M.concat(acc, o.right);
  }
  return acc === undefined ? none<T>() : some(acc);
}

```

