import type { DomainAdapter } from "./domain/domain.adapter";
import { liftScalars } from "./domain/domain.expr";
import { ExpressionType } from "./expr/expr.enum";
import type { ArgRef } from "./expr/expr.ir";
import { StepSwitchTo, StepType, type Step } from "./expr/expr.step";
import { isFound, none, Optional, some } from "../external/Funk/optional/optional";
import { type OpMeta, DSL_OP_META } from "./op.meta";
import { sequenceArrayOpt } from "../optional.utils";
import type { Scope } from "./scope/scope";
import { chainOpt, mapOpt } from "../optional.utils";

function evalArg<D>(adapter: DomainAdapter<D>, a: ArgRef<D>, current: Optional<D>, scope?: Scope<D>): Optional<any> {
  switch (a.t) {
    case ExpressionType.ConstD:     return some(a.v);
    case ExpressionType.ConstS:     return some(a.v);
    case ExpressionType.PropRef:    return scope ? scope.getPropOpt(a.name) : none();
    case ExpressionType.OfRef:      return scope ? scope.getPropOfOpt(a.key, a.prop) : none();
    case ExpressionType.NestedExpr: return isFound(current) ? a.expr.build(adapter)(current, scope) : none();
    case ExpressionType.Current:    return current;
  }
}

export function evalProgram<D>(
  adapter: DomainAdapter<D>,
  steps: Step<D>[],
  initial: Optional<D>,
  scope?: Scope<D>
): Optional<any> {
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
      // cur must be a domain value; keep it total
      cur = chainOpt(cur as Optional<D>, (self) => {
        if (!adapter.isInstance(self)) return none();
        const method = adapter.getMethod(self, s.op);
        if (!method) return none();

        const meta = (method as any)[DSL_OP_META] as OpMeta | undefined;

        // evaluate args (each Optional)
        const argOpts = s.args.map((a) => evalArg(adapter, a, cur as Optional<D>, scope));
        const argsArr = sequenceArrayOpt(argOpts);
        return chainOpt(argsArr, (args) => {
          const callArgs = liftScalars(adapter, meta, args);
          try {
            return some(method.apply(self, callArgs));
          } catch {
            return none();
          }
        });
      });
      continue;
    }
  }
  return cur;
}
