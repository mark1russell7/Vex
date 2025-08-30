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

