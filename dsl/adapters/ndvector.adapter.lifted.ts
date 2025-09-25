import { DomainAdapter } from "../domain/domain.adapter";
import { annotateOp } from "../op.meta";
import { ValueKind } from "../value.enum";
import { NDVector } from "../../math/vector/ndvector";

/**
 * LiftedNDVectorAdapter:
 * - fromScalar(n) => { scalar: n } one-hot vector
 * - liftScalar=true on add/subtract/multiply/dot so numbers can appear where vectors are expected
 *   (e.g., add(5) => add({scalar:5}))
 */
export const LiftedNDVectorAdapter: DomainAdapter<NDVector> = {
  name: "NDVector(lifted)",
  isInstance: (v: unknown): v is NDVector => v instanceof NDVector,
  getMethod(self: NDVector, name: string) { return (self as any)[name]; },
  fromScalar: (n: number) => new NDVector({ scalar: n }),
  methodReturns(name: string) {
    if (name === "length" || name === "dot" || name === "norm1" || name === "normInf") return ValueKind.Scalar;
    return ValueKind.Domain;
  },
  methodParams(name: string) {
    if (name === "add")       return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "subtract")  return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "multiply")  return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "scale")     return [{ name: "k",     kind: ValueKind.Scalar }];
    if (name === "clamp")     return [{ name: "min",   kind: ValueKind.Scalar }, { name: "max", kind: ValueKind.Scalar }];
    if (name === "dot")       return [{ name: "rhs",   kind: ValueKind.Domain }];
    return [];
  },
};

// metadata + liftScalar
(function annotate() {
  const P = NDVector.prototype as any;
  annotateOp(P, "add",       { commutative: true,  associative: true,  liftScalar: true });
  annotateOp(P, "subtract",  { liftScalar: true });
  annotateOp(P, "multiply",  { commutative: true,  associative: true,  liftScalar: true });
  annotateOp(P, "dot",       { commutative: true,  liftScalar: true });
  annotateOp(P, "scale",     { /* scalar */ });
  annotateOp(P, "clamp",     { /* scalars */ });
})();
