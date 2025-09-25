import { DomainAdapter } from "../domain/domain.adapter";
import { annotateOp } from "../op.meta";
import { ValueKind } from "../value.enum";
import { Color } from "../../math/color/color";

/** Domain adapter for Color */
export const ColorAdapter: DomainAdapter<Color> = {
  name: "Color",
  isInstance: (v: unknown): v is Color => v instanceof Color,
  getMethod(self: Color, name: string) { return (self as any)[name]; },
  // map returns: add/multiply/clamp are Domain; toVector is "unknown" (not a domain)
  methodReturns(name: string) {
    if (name === "toVector") return ValueKind.Unknown;
    return ValueKind.Domain;
  },
  fromScalar: (n: number) => new Color(n, n, n, 1), // grayscale "lift" when allowed
  partial(self, op, bound, vals) {
    const next = new Color(self.r, self.g, self.b, self.a);
    (next as any).__partial__ = { op, bound, vals, self };
    (next as any).finish = function (...rest: any[]) {
      const method = (self as any)[op];
      return method.apply(self, [...vals, ...rest]);
    };
    return next;
  },
};

// metadata
(function annotate() {
  const P = Color.prototype as any;
  annotateOp(P, "add",      { commutative: true,  associative: true, liftScalar: false }); // rhs must be Color
  annotateOp(P, "multiply", { /* scalar */ liftScalar: false }); // multiply expects number, not lifted to Color
  annotateOp(P, "clamp",    { /* scalars */ liftScalar: false });
})();

// param specs (ALWAYS return an array, empty when unknown)
ColorAdapter.methodParams = (name: string) => {
  if (name === "add")       return [{ name: "rhs",    kind: ValueKind.Domain }];
  if (name === "multiply")  return [{ name: "factor", kind: ValueKind.Scalar }];
  if (name === "clamp")     return [{ name: "min",    kind: ValueKind.Scalar }, { name: "max", kind: ValueKind.Scalar }];
  if (name === "toVector")  return []; // taking no args in our demo impl
  return [];
};
