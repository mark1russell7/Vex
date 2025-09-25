import type { DomainAdapter } from "../domain/domain.adapter";
import { domainExpr, DomainExpr, normalizeArgs } from "../domain/domain.expr";
import { StepSwitchTo, StepType, type Step } from "../expr/expr.step";
import type { Scope } from "../scope/scope";
import { none, type Optional } from "../../external/Funk/optional/optional";
import { makeMapScope } from "../scope/map.scope";
import { makeArrayScope } from "../scope/array.scope";
import { makeMatrixScope } from "../scope/matrix.scope";
import { makeTraversal, Traversal } from "../traversal";
import { withLocal } from "./local.mixin";
import { ValueKind } from "../value.enum";

export class BaseChain<Obj, D> {
  protected steps: Step<D>[] = [];
  protected adapter: DomainAdapter<D>;
  protected scope: Scope<D>;

  constructor(adapter: DomainAdapter<D>, scope: Scope<D>) {
    this.adapter = adapter; this.scope = scope;
    (this as any)._steps = this.steps;
  }

  prop(name: string): this { this.steps.push({ t: StepType.Select, prop: name } as any); return this; }

  get _(): any {
    const self = this;
    return new Proxy({}, {
      get(_t, op: string) {
        return (...args: any[]) => { self.steps.push({ t: StepType.Invoke, op, args: normalizeArgs<D>(args) } as any); return self; };
      }
    });
  }

  self(keyOrIndex?: string | number) { this.steps.push({ t: StepType.Switch, to: typeof keyOrIndex === 'number' ? StepSwitchTo.Index : StepSwitchTo.Self, key: keyOrIndex } as any); return this; }
  other(keyOrIndex?: string | number) { this.steps.push({ t: StepType.Switch, to: StepSwitchTo.Other, key: keyOrIndex } as any); return this; }

  build(): (start: string | number) => Optional<any> {
    const adapter = this.adapter;
    const scope   = this.scope;
    const steps   = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);
    return (start: string | number) => {
      if (typeof start === "number") scope.setFocusByIndex(start); else scope.setFocusByKey(String(start));
      const hasSelect = steps.some(s => s.t === StepType.Select);
      if (!hasSelect) return none();
      return program(none(), scope);
    };
  }
  value(start: string | number): Optional<any> { return this.build()(start); }

  traverse<R = any>(expr?: DomainExpr<D> | ReturnType<typeof domainExpr<D>>): Traversal<R> {
    const adapter = this.adapter, scope = this.scope;
    const steps = [...this.steps], program = new DomainExpr<D>(steps).build(adapter);
    const keys = scope.keys();
    const mapper  = expr ? ((expr as any).__isDomainExpr ? (expr as any)._expr as DomainExpr<D> : (expr as DomainExpr<D>)) : undefined;
    const mapFn   = mapper?.build(adapter);

    const out: Optional<any>[] = [];
    for (const k of keys) {
      scope.setFocusByKey(k);
      const base = program(none(), scope);
      out.push(mapFn ? (base.tag === 'Right' ? mapFn(base, scope) : base) : base);
    }
    const invoke = (a: any, op: string, b: any) => { const fn = a?.[op]; return typeof fn === 'function' ? fn.call(a,b) : undefined; };
    return makeTraversal<R>({ values: out as Optional<R>[], invoke });
  }

  traverseStrict<R = any>(expr?: DomainExpr<D> | ReturnType<typeof domainExpr<D>>): Traversal<R> {
    const adapter = this.adapter, scope = this.scope;
    const steps = [...this.steps], program = new DomainExpr<D>(steps).build(adapter);
    const keys = scope.keys();
    const mapper  = expr ? ((expr as any).__isDomainExpr ? (expr as any)._expr as DomainExpr<D> : (expr as DomainExpr<D>)) : undefined;
    const mapFn   = mapper?.build(adapter);

    const out: Optional<any>[] = [];
    for (const k of keys) {
      scope.setFocusByKey(k);
      const base = program(none(), scope, { strict: true });
      const mapped = mapFn ? (base.tag === 'Right' ? mapFn(base, scope) : none()) : base;
      out.push(mapped);
    }
    const invoke = (a: any, op: string, b: any) => { const fn = a?.[op]; return typeof fn === 'function' ? fn.call(a,b) : undefined; };
    return makeTraversal<R>({ values: out as Optional<R>[], invoke });
  }
}

/* Default (untyped local) factories */
export function mapChain<Obj extends Record<string, any>, D>(adapter: DomainAdapter<D>, map: Record<string, Obj>) {
  const Chain = withLocal<Obj, D, typeof BaseChain>(BaseChain as any);
  return new (Chain as any)(adapter, makeMapScope(map, adapter));
}
export function arrayChain<Obj extends Record<string, any>, D>(adapter: DomainAdapter<D>, arr: Obj[]) {
  const Chain = withLocal<Obj, D, typeof BaseChain>(BaseChain as any);
  return new (Chain as any)(adapter, makeArrayScope(arr, adapter));
}
export function matrixChain<Obj extends Record<string, any>, D>(adapter: DomainAdapter<D>, grid: Obj[][]) {
  const Chain = withLocal<Obj, D, typeof BaseChain>(BaseChain as any);
  return new (Chain as any)(adapter, makeMatrixScope(grid, adapter));
}

/* -------------------------------------------------------------
 * Helper factories for **typed local** (compile-time param shapes)
 * ------------------------------------------------------------- */

export function mapChainTyped<
  Obj extends Record<string, any>,
  D,
  S extends Record<string, ValueKind>
>(adapter: DomainAdapter<D>, map: Record<string, Obj>) {
  const Chain = withLocal<Obj, D, typeof BaseChain, S>(BaseChain as any);
  return new (Chain as any)(adapter, makeMapScope(map, adapter)) as InstanceType<typeof Chain>;
}

export function arrayChainTyped<
  Obj extends Record<string, any>,
  D,
  S extends Record<string, ValueKind>
>(adapter: DomainAdapter<D>, arr: Obj[]) {
  const Chain = withLocal<Obj, D, typeof BaseChain, S>(BaseChain as any);
  return new (Chain as any)(adapter, makeArrayScope(arr, adapter)) as InstanceType<typeof Chain>;
}

export function matrixChainTyped<
  Obj extends Record<string, any>,
  D,
  S extends Record<string, ValueKind>
>(adapter: DomainAdapter<D>, grid: Obj[][]) {
  const Chain = withLocal<Obj, D, typeof BaseChain, S>(BaseChain as any);
  return new (Chain as any)(adapter, makeMatrixScope(grid, adapter)) as InstanceType<typeof Chain>;
}
