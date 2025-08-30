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