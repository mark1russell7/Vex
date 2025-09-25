import { DomainAdapter } from "../domain/domain.adapter";
import { annotateOp } from "../op.meta";
import { ValueKind } from "../value.enum";
import { Angle } from "../../math/angle/angle";

/** Domain adapter for Angle */
export const AngleAdapter: DomainAdapter<Angle> = {
  name: "Angle",
  isInstance: (v: unknown): v is Angle => v instanceof Angle,
  getMethod(self: Angle, name: string) { return (self as any)[name]; },
  methodReturns(name: string) {
    if (name === "toVector") return ValueKind.Unknown;
    return ValueKind.Domain;
  },
  partial(self, op, boundNames, boundValues) {
    const next = new Angle(self.radians);
    (next as any).__partial__ = { op, boundNames, boundValues, self };
    (next as any).finish = function (...rest: any[]) {
      const method = (self as any)[op];
      return method.apply(self, [...boundValues, ...rest]);
    };
    return next;
  }
};

(function annotate() {
  const P = Angle.prototype as any;
  annotateOp(P, "add",   { commutative: true, associative: true });
  annotateOp(P, "scale", { /* scalar */ });
})();

/** ALWAYS return an array (empty when unknown) */
AngleAdapter.methodParams = (name: string) => {
  if (name === "add")       return [{ name: "rhs",    kind: ValueKind.Domain }];
  if (name === "scale")     return [{ name: "factor", kind: ValueKind.Scalar }];
  if (name === "toVector")  return [{ name: "length", kind: ValueKind.Scalar }];
  return []; // <- key change: never undefined
};
