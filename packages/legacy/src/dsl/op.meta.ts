/** Optional metadata on methods of the domain (attached to the function or a prototype table). */
export type OpMeta = {
  commutative?: boolean;
  associative?: boolean;
  /** Auto-lift number → domain (e.g., fromScalar) for arguments. boolean = all args, tuple = per arg. */
  liftScalar?: boolean | boolean[];
  pure?: boolean;
};

/** Per-function metadata tag (when the method exists on the prototype as a function). */
export const DSL_OP_META: unique symbol = Symbol("dsl:op-meta");
/** Per-prototype metadata table (for instance-field/arrow methods that aren’t present on the prototype). */
export const DSL_OP_META_TABLE: unique symbol = Symbol("dsl:op-meta-table");

/**
 * Annotate a domain operation with metadata.
 * - If `proto[methodName]` is a function → attach to that function (preferred).
 * - Otherwise → record in a prototype-level table under `DSL_OP_META_TABLE` for later lookup by name.
 */
export function annotateOp(proto: any, methodName: string, meta: OpMeta) {
  const fn = proto?.[methodName];

  if (typeof fn === "function") {
    // Attach to the function itself
    const prev = (fn as any)[DSL_OP_META] as OpMeta | undefined;
    Object.defineProperty(fn, DSL_OP_META, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: { ...(prev ?? {}), ...meta } as OpMeta,
    });
    return;
  }

  // Fallback: store on a prototype-level table keyed by method name
  const table: Record<string, OpMeta> = proto[DSL_OP_META_TABLE] ?? {};
  proto[DSL_OP_META_TABLE] = table;
  table[methodName] = { ...(table[methodName] ?? {}), ...meta };
}
