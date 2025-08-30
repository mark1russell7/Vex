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
