import type { DomainAdapter } from "./domain.adapter";
import { type ArgRef } from "../expr/expr.ir";
import { ExpressionType } from "../expr/expr.enum";
import { StepType, type Step } from "../expr/expr.step";
import type { Scope } from "../scope/scope";
import type { Optional } from "../../external/Funk/optional/optional";
import { evalProgram } from "../eval";

/* ---------------- Domain Expressions ---------------- */
export class DomainExpr<D, R = any> {
  constructor(private steps: Step<D>[] = []) {}
  _push(step: Step<D>): this { this.steps.push(step); return this; }
  copy(): DomainExpr<D, R> { return new DomainExpr<D, R>([...this.steps]); }
  build(adapter: DomainAdapter<D>) {
    const program = [...this.steps];
    return (initial: Optional<D>, scope?: Scope<D>, opts?: { strict?: boolean }): Optional<any> =>
      evalProgram(adapter, program, initial, scope, opts);
  }
}

/** Proxy that records *any* method name + args (no per-method boilerplate). */
export function domainExpr<D>() {
  const expr = new DomainExpr<D>();
  const proxy = new Proxy(function () {}, {
    get(_t, prop: string) {
      if (prop === "__isDomainExpr") return true;
      if (prop === "_expr") return expr;
      if (prop === "select") return (p: string) => (expr._push({ t: StepType.Select, prop: p } as any), proxy);
      if (prop === "identity") return () => proxy;
      return (...args: any[]) => {
        expr._push({ t: StepType.Invoke, op: String(prop), args: normalizeArgs<D>(args) } as any);
        return proxy;
      };
    }
  });
  return proxy as any;
}

export function normalizeArgs<D>(args: any[]): ArgRef<D>[] {
  return args.map(a => {
    if (typeof a === "number") return { t: ExpressionType.ConstS, v: a } as any;
    if (a && (a as any).__isDomainExpr) return { t: ExpressionType.NestedExpr, expr: (a as any)._expr } as any;
    if (Array.isArray(a) && a.length === 2 && typeof a[0] === "string" && typeof a[1] === "string")
      return { t: ExpressionType.OfRef, key: a[0], prop: a[1] } as any;
    if (typeof a === "string") return { t: ExpressionType.PropRef, name: a } as any;
    return { t: ExpressionType.ConstD, v: a } as any;
  });
}
