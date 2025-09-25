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
    if (name.startsWith("any") || name.startsWith("all")) return ValueKind.Boolean;
    if (name === "length" || name === "area" || name === "sum") return ValueKind.Scalar;
    return undefined;
  },
};

(function annotateVector() {
  const P = Vector.prototype as any;
  annotateOp(P, "add",       { commutative: true, associative: true, liftScalar: true });
  annotateOp(P, "multiply",  { commutative: true, associative: true, liftScalar: true });
  annotateOp(P, "subtract",  { liftScalar: true });
  annotateOp(P, "divide",    { liftScalar: true });
  annotateOp(P, "scale",     { /* scalar only */ });
})();

/** ALWAYS return an array (empty when unknown) */
VectorAdapter.methodParams = (name: string) => {
  if (name === "add" || name === "subtract" || name === "multiply" || name === "divide")
    return [{ name: "rhs", kind: ValueKind.Domain }];
  if (name === "rotate") return [{ name: "radians", kind: ValueKind.Scalar }];
  if (name === "scale")  return [{ name: "factor",  kind: ValueKind.Scalar }];
  return []; // <- key change: never undefined
};

// Facade
export const vectorExpr = () => domainExpr<Vector>();
export const vectorMapChain    = <Obj extends Record<string, any>>(map: Record<string, Obj>) => mapChain<Obj, Vector>(VectorAdapter, map);
export const vectorArrayChain  = <Obj extends Record<string, any>>(arr: Obj[])              => arrayChain<Obj, Vector>(VectorAdapter, arr);
export const vectorMatrixChain = <Obj extends Record<string, any>>(grid: Obj[][])           => matrixChain<Obj, Vector>(VectorAdapter, grid);
