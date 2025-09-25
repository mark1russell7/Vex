import { DomainAdapter } from "../domain/domain.adapter";
import { annotateOp } from "../op.meta";
import { ValueKind } from "../value.enum";
import { NDVector } from "../../math/vector/ndvector";

/** Domain adapter for NDVector (named-component vectors). */
export const NDVectorAdapter: DomainAdapter<NDVector> = {
  name: "NDVector",
  isInstance: (v: unknown): v is NDVector => v instanceof NDVector,
  getMethod(self: NDVector, name: string) { return (self as any)[name]; },
  fromScalar: (n: number) => new NDVector({}), // we DO NOT lift scalars to vectors by default (empty)
  methodReturns(name: string) {
    if (name === "length" || name === "dot" || name === "norm1" || name === "normInf") return ValueKind.Scalar;
    // all others here return a domain NDVector
    return ValueKind.Domain;
  },
  methodParams(name: string) {
    // All return arrays (empty when unknown)
    if (name === "add")       return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "subtract")  return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "multiply")  return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "scale")     return [{ name: "k",     kind: ValueKind.Scalar }];
    if (name === "clamp")     return [{ name: "min",   kind: ValueKind.Scalar }, { name: "max", kind: ValueKind.Scalar }];
    if (name === "dot")       return [{ name: "rhs",   kind: ValueKind.Domain }];
    if (name === "pick")      return []; // you can call pick via nested expr or local (keys aren’t scalars; pass via expr)
    if (name === "withKeys")  return []; // same note as pick
    return [];
  },
};

// Attach metadata (function present on the class prototype)
(function annotate() {
  const P = NDVector.prototype as any;
  annotateOp(P, "add",       { commutative: true,  associative: true });
  annotateOp(P, "subtract",  { });
  annotateOp(P, "multiply",  { commutative: true,  associative: true });
  annotateOp(P, "scale",     { /* scalar */ });
  annotateOp(P, "clamp",     { /* scalars */ });
  annotateOp(P, "dot",       { commutative: true });
})();
