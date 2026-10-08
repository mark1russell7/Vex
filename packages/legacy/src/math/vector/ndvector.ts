/**
 * NDVector: a named-component immutable vector.
 * - Internally stores a Record<string, number>
 * - All operations are pure (return new NDVector)
 * - Missing components are treated as 0 when combining vectors
 * - You can restrict or widen keys with pick/withKeys
 */
export class NDVector {
  /** components: name → number */
  public readonly c: Readonly<Record<string, number>>;

  constructor(c: Record<string, number>) {
    // normalize: only finite numbers; drop undefined/null; copy
    const out: Record<string, number> = {};
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    this.c = Object.freeze({ ...out });
  }

  /** Zero vector on given keys (or empty if none). */
  static zero(keys: ReadonlyArray<string> = []): NDVector {
    const c: Record<string, number> = {};
    for (const k of keys) c[k] = 0;
    return new NDVector(c);
  }

  /** Create from pairs: NDVector.of([['x',1], ['y',2]]) */
  static of(entries: Array<[string, number]>): NDVector {
    const c: Record<string, number> = {};
    for (const [k, v] of entries) c[k] = v;
    return new NDVector(c);
  }

  /** Keys present */
  keys(): string[] { return Object.keys(this.c); }

  /** Get component (0 if absent) */
  get(k: string): number { return this.c[k] ?? 0; }

  /** Set/replace component (immutably) */
  set(k: string, v: number): NDVector {
    return new NDVector({ ...this.c, [k]: v });
  }

  /** Map components with f(name, value) */
  map(f: (name: string, v: number) => number): NDVector {
    const c: Record<string, number> = {};
    for (const k of Object.keys(this.c)) c[k] = f(k, this.c[k]);
    return new NDVector(c);
  }

  /** Pick a subset of keys (missing → 0, dropped if zero unless keepZeros=true) */
  pick(keys: ReadonlyArray<string>, keepZeros = false): NDVector {
    const c: Record<string, number> = {};
    for (const k of keys) {
      const v = this.get(k);
      if (keepZeros || v !== 0) c[k] = v;
    }
    return new NDVector(c);
  }

  /** Extend to include union with rhs keys (zeros included if keepZeros) */
  withKeys(keys: ReadonlyArray<string>, keepZeros = true): NDVector {
    const all = new Set([...Object.keys(this.c), ...keys]);
    const c: Record<string, number> = {};
    for (const k of all) {
      const v = this.get(k);
      if (keepZeros || v !== 0) c[k] = v;
    }
    return new NDVector(c);
  }

  /** Point-wise combine with rhs; missing treated as 0 */
  private combine(rhs: NDVector, op: (a: number, b: number) => number, dropZeros = false): NDVector {
    const keys = new Set([...Object.keys(this.c), ...Object.keys(rhs.c)]);
    const c: Record<string, number> = {};
    for (const k of keys) {
      const v = op(this.get(k), rhs.get(k));
      if (!dropZeros || v !== 0) c[k] = v;
    }
    return new NDVector(c);
  }

  /** a + rhs (component-wise) */
  add(rhs: NDVector): NDVector { return this.combine(rhs, (a,b)=>a+b); }

  /** a - rhs (component-wise) */
  subtract(rhs: NDVector): NDVector { return this.combine(rhs, (a,b)=>a-b); }

  /** Hadamard product (component-wise multiply) */
  multiply(rhs: NDVector): NDVector { return this.combine(rhs, (a,b)=>a*b); }

  /** Scale by scalar (k ⋅ a) */
  scale(k: number): NDVector {
    const c: Record<string, number> = {};
    for (const kname of Object.keys(this.c)) c[kname] = this.c[kname] * k;
    return new NDVector(c);
  }

  /** Clamp each component into [min, max] */
  clamp(min = -Infinity, max = Infinity): NDVector {
    return this.map((_k, v) => Math.min(max, Math.max(min, v)));
  }

  /** Dot product (Σ a_k * b_k, union of keys) */
  dot(rhs: NDVector): number {
    let sum = 0;
    const keys = new Set([...Object.keys(this.c), ...Object.keys(rhs.c)]);
    for (const k of keys) sum += this.get(k) * rhs.get(k);
    return sum;
  }

  /** L2 length */
  length(): number {
    let s = 0; for (const k of Object.keys(this.c)) s += this.c[k]*this.c[k];
    return Math.sqrt(s);
  }

  /** L1 norm */
  norm1(): number {
    let s = 0; for (const k of Object.keys(this.c)) s += Math.abs(this.c[k]);
    return s;
  }

  /** Max component (∞-norm) */
  normInf(): number {
    let m = 0; for (const k of Object.keys(this.c)) m = Math.max(m, Math.abs(this.c[k]));
    return m;
  }

  /** Merge: prefer this when non-zero, else rhs */
  mergePreferNonZero(rhs: NDVector): NDVector {
    const keys = new Set([...Object.keys(this.c), ...Object.keys(rhs.c)]);
    const c: Record<string, number> = {};
    for (const k of keys) {
      const a = this.get(k), b = rhs.get(k);
      c[k] = a !== 0 ? a : b;
    }
    return new NDVector(c);
  }

  /** JSON-ish */
  toJSON(): Record<string, number> { return { ...this.c }; }
  toString(): string { return `NDVector(${JSON.stringify(this.c)})`; }
}
