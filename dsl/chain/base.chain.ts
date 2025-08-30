/* ---------------- Focused chains over map/array/matrix ---------------- */

import { type DomainAdapter } from "../domain/domain.adapter";
import { domainExpr, DomainExpr, normalizeArgs } from "../domain/domain.expr";
import { StepSwitchTo, StepType, type Step } from "../expr/expr.step";
import { type KeysOfType } from "../lenses";
import { type Scope } from "../scope/scope";
import { isFound, none, Optional } from "../../external/Funk/optional/optional";
import { makeTraversal, Traversal } from "../traversal";
import { makeMapScope } from "../scope/map.scope";
import { makeArrayScope } from "../scope/array.scope";
import { makeMatrixScope } from "../scope/matrix.scope";

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

  /** Dynamic method calls after .prop(...) using shared normalization */
  get _(): any {
    const self = this;
    return new Proxy({}, {
      get(_t, op: string) {
        return (...args: any[]) => {
          self.steps.push({ t: StepType.Invoke, op, args: normalizeArgs<D>(args) });
          return self;
        };
      }
    });
  }

  self(keyOrIndex?: string | number) {
    this.steps.push({ t: StepType.Switch, to: typeof keyOrIndex === "number" ? StepSwitchTo.Index : StepSwitchTo.Self, key: keyOrIndex });
    return this;
  }
  other(keyOrIndex?: string | number) {
    this.steps.push({ t: StepType.Switch, to: StepSwitchTo.Other, key: keyOrIndex });
    return this;
  }

  build(): (start: string | number) => Optional<any> {
    const adapter = this.adapter;
    const scope   = this.scope;
    const steps   = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);

    return (start: string | number) => {
      if (typeof start === "number") scope.setFocusByIndex(start);
      else scope.setFocusByKey(String(start));
      const hasSelect = steps.some(s => s.t === StepType.Select);
      if (!hasSelect) return none();
      return program(none(), scope);
    };
  }

  value(start: string | number): Optional<any> { return this.build()(start); }

  traverse<R = any>(expr?: DomainExpr<D> | ReturnType<typeof domainExpr<D>>): Traversal<R> {
    const adapter = this.adapter;
    const scope   = this.scope;
    const steps   = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);
    const keys    = scope.keys();

    const mapper  = expr ? ((expr as any).__isDomainExpr ? (expr as any)._expr as DomainExpr<D> : (expr as DomainExpr<D>)) : undefined;
    const mapFn   = mapper?.build(adapter);

    const out: Optional<any>[] = [];
    for (const k of keys) {
      scope.setFocusByKey(k);
      const base = program(none(), scope);
      out.push(mapFn ? (isFound(base) ? mapFn(base, scope) : base) : base);
    }

    const invoke = (a: any, op: string, b: any) => {
      const fn = a?.[op];
      return typeof fn === "function" ? fn.call(a, b) : undefined;
    };

    return makeTraversal<R>({ values: out as Optional<R>[], invoke });
  }

  peers<R = any>(expr?: DomainExpr<D> | ReturnType<typeof domainExpr<D>>): Traversal<R> {
    const adapter = this.adapter;
    const scope   = this.scope;
    const steps   = [...this.steps];
    const program = new DomainExpr<D>(steps).build(adapter);
    const keys    = scope.keys();
    const start   = scope.currentKey();

    const mapper  = expr ? ((expr as any).__isDomainExpr ? (expr as any)._expr as DomainExpr<D> : (expr as DomainExpr<D>)) : undefined;
    const mapFn   = mapper?.build(adapter);

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

    scope.setFocusByKey(start);

    return makeTraversal<R>({ values: out as Optional<R>[], invoke });
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
