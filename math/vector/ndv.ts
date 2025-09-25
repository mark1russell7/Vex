import { NDVector } from "./ndvector";

/**
 * NDV<K> — a typed façade over NDVector with named keys K.
 * - Immutable and pure, like NDVector
 * - Methods return NDV with the right key set (e.g., add merges keys)
 * - Perfectly interoperable with NDVectorAdapter (NDV extends NDVector)
 */
export class NDV<K extends string> extends NDVector {
  /** Construct from a Record with EXACT keys of type K */
  constructor(c: Record<K, number>) {
    // NDVector expects Record<string, number>; we keep the same runtime, narrow type statically
    super(c as Record<string, number>);
  }

  /** Create from exact record */
  static fromExact<K extends string>(c: Record<K, number>): NDV<K> {
    return new NDV<K>(c);
  }

  /** Create from entries */
  static of<K extends string>(entries: Array<[K, number]>): NDV<K> {
    const c: Record<string, number> = {};
    for (const [k, v] of entries) c[k as string] = v;
    return new NDV<K>(c as Record<K, number>);
  }

  /** Get a typed component (0 if missing) */
  getT(k: K): number { return this.get(k); }

  /** Set returns NDV with the same K */
  setT(k: K, v: number): NDV<K> {
    const c = { ...(this.c as Record<string, number>), [k]: v } as Record<K, number>;
    return new NDV<K>(c);
  }

  /** Scale by scalar: NDV<K> */
  scale(k: number): NDV<K> {
    const base = super.scale(k);
    return new NDV<K>(base.c as Record<K, number>);
  }

  /** Clamp: NDV<K> */
  clamp(min = -Infinity, max = Infinity): NDV<K> {
    const base = super.clamp(min, max);
    return new NDV<K>(base.c as Record<K, number>);
  }

  /** Map components: NDV<K> */
  mapT(f: (name: K, v: number) => number): NDV<K> {
    const c: Record<string, number> = {};
    for (const key of Object.keys(this.c)) c[key] = f(key as K, this.c[key]);
    return new NDV<K>(c as Record<K, number>);
  }

  /** Pick typed subset of existing keys: NDV<K2> where K2 ⊆ K */
  pickT<K2 extends K>(keys: readonly K2[], keepZeros = false): NDV<K2> {
    // NDVector.pick expects a mutable string[]; copy the readonly keys into a new array
    const base = super.pick(Array.from(keys as readonly string[]), keepZeros);
    return new NDV<K2>(base.c as Record<K2, number>);
  }

  /** Extend to include new keys: NDV<K ∪ K2> */
  withKeysT<K2 extends string>(keys: readonly K2[], keepZeros = true): NDV<K | K2> {
    const base = super.withKeys(Array.from(keys as readonly string[]), keepZeros);
    return new NDV<K | K2>(base.c as Record<K | K2, number>);
  }

  /** add: NDV<K ∪ K2> */
  addT<K2 extends string>(rhs: NDV<K2> | NDVector): NDV<K | K2> {
    const base = super.add(rhs instanceof NDVector ? rhs : (rhs as NDVector));
    return new NDV<K | K2>(base.c as Record<K | K2, number>);
  }

  /** subtract: NDV<K ∪ K2> */
  subtractT<K2 extends string>(rhs: NDV<K2> | NDVector): NDV<K | K2> {
    const base = super.subtract(rhs instanceof NDVector ? rhs : (rhs as NDVector));
    return new NDV<K | K2>(base.c as Record<K | K2, number>);
  }

  /** hadamard multiply: NDV<K ∪ K2> */
  multiplyT<K2 extends string>(rhs: NDV<K2> | NDVector): NDV<K | K2> {
    const base = super.multiply(rhs instanceof NDVector ? rhs : (rhs as NDVector));
    return new NDV<K | K2>(base.c as Record<K | K2, number>);
  }

  /** Dot product: number (union of keys) */
  dotT<K2 extends string>(rhs: NDV<K2> | NDVector): number {
    return super.dot(rhs instanceof NDVector ? rhs : (rhs as NDVector));
  }

  /** Length, norm1/normInf already obtained from NDVector */
  length(): number { return super.length(); }
  norm1(): number  { return super.norm1(); }
  normInf(): number { return super.normInf(); }

  /** Merge preferring non-zero of this: NDV<K ∪ K2> */
  mergePreferNonZeroT<K2 extends string>(rhs: NDV<K2> | NDVector): NDV<K | K2> {
    const base = super.mergePreferNonZero(rhs instanceof NDVector ? rhs : (rhs as NDVector));
    return new NDV<K | K2>(base.c as Record<K | K2, number>);
  }

  /** downcast to base (when needed) */
  toBase(): NDVector { return new NDVector(this.c); }
}
