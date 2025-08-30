
/** Optional metadata on methods of the domain (attached to the prototype). */
export type OpMeta = {
  commutative?: boolean;
  associative?: boolean;
  /** Auto-lift number → domain (e.g., Vector.scalar) for arguments. boolean = all args, tuple = per arg. */
  liftScalar?: boolean | boolean[];
  /** Mark pure to enable memoization (not used below, but handy to have). */
  pure?: boolean;
};

export const DSL_OP_META: unique symbol = Symbol("dsl:op-meta");
export function annotateOp(proto: any, methodName: string, meta: OpMeta) {
  const fn = proto?.[methodName];
  if (typeof fn !== "function") throw new Error(`annotateOp: '${methodName}' is not a function`);
  Object.defineProperty(fn, DSL_OP_META, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: { ...(fn[DSL_OP_META] ?? {}), ...meta } as OpMeta
  });
}