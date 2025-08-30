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

