import { DomainAdapter } from "../domain/domain.adapter";
import { annotateOp } from "../op.meta";
import { ValueKind } from "../value.enum";
import { TBBox } from "../../monads/tbbox";

/** Adapter for TBBox<T> — wraps a value with Top/Bottom. */
export const TBAdapter: DomainAdapter<TBBox<any>> = {
  name: "TBBox",
  isInstance: (v: unknown): v is TBBox<any> => v instanceof TBBox,
  getMethod(self: TBBox<any>, name: string) { return (self as any)[name]; },
  methodReturns(name: string) {
    if (name === "isTop" || name === "isBottom") return ValueKind.Boolean;
    if (name === "getOptional" || name === "valueOr") return ValueKind.Unknown;
    // map/chain return Domain (TBBox)
    return ValueKind.Domain;
  },
  methodParams(name: string) {
    if (name === "map")       return ["f"];    // unknown kind (function) — we won’t validate kinds here
    if (name === "chain")     return ["f"];    // same
    if (name === "valueOr")   return ["fallback"];
    return []; // others have no args
  },
};

// Annotate (no scalar lift)
(function annotate() {
  const P = TBBox.prototype as any;
  annotateOp(P, "map",       { });
  annotateOp(P, "chain",     { });
  annotateOp(P, "getOptional",{ });
  annotateOp(P, "valueOr",   { });
})();
