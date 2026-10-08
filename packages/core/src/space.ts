import { vexError } from "./errors.ts";
import type { Addr, Axis, Move } from "./ir.ts";
import { fail, ok, type Result } from "./result.ts";

/** The kind of a space. The kind sets which moves and axes are valid. */
export type SpaceKind = "record" | "array" | "grid";

/**
 * A space: an immutable collection of records with keys. A Vex program evaluates at one key of a space.
 * Nothing changes a space after it is made.
 */
export interface Space<K extends string = string, O = unknown> {
  readonly kind: SpaceKind;
  /** The keys, in their order. */
  readonly keys: readonly K[];
  /** This function tells if the space has the key `k`. */
  has(k: string): k is K;
  /** This function gives the record at the key `k`, or `undefined`. */
  get(k: string): O | undefined;
  /** The position of each key, for array and grid spaces. An array key has one number, a grid key has two. */
  coords(k: string): readonly number[] | undefined;
  /** The key at a position, or `undefined`. */
  keyAt(coords: readonly number[]): K | undefined;
}

/** The key type of a grid space. */
export type GridKey = `${number},${number}`;

/** The key type of an array space. */
export type ArrayKey = `${number}`;

class RecordSpace<K extends string, O> implements Space<K, O> {
  readonly kind: SpaceKind = "record";
  readonly keys: readonly K[];
  readonly #records: ReadonlyMap<string, O>;

  constructor(records: Readonly<Record<K, O>>) {
    const entries = Object.entries(records) as [K, O][];
    this.keys = Object.freeze(entries.map(([k]) => k));
    this.#records = new Map(entries);
  }

  has(k: string): k is K {
    return this.#records.has(k);
  }
  get(k: string): O | undefined {
    return this.#records.get(k);
  }
  coords(): readonly number[] | undefined {
    return undefined;
  }
  keyAt(): K | undefined {
    return undefined;
  }
}

class ArraySpace<O> implements Space<ArrayKey, O> {
  readonly kind: SpaceKind = "array";
  readonly keys: readonly ArrayKey[];
  readonly #items: readonly O[];

  constructor(items: readonly O[]) {
    this.#items = Object.freeze([...items]);
    this.keys = Object.freeze(this.#items.map((_, i): ArrayKey => `${i}`));
  }

  has(k: string): k is ArrayKey {
    return this.coords(k) !== undefined;
  }
  get(k: string): O | undefined {
    const c = this.coords(k);
    return c === undefined ? undefined : this.#items[c[0] ?? -1];
  }
  coords(k: string): readonly number[] | undefined {
    if (!/^(0|[1-9][0-9]*)$/.test(k)) return undefined;
    const i = Number(k);
    return i < this.#items.length ? [i] : undefined;
  }
  keyAt(coords: readonly number[]): ArrayKey | undefined {
    const [i] = coords;
    return coords.length === 1 && i !== undefined && i >= 0 && i < this.#items.length ? `${i}` : undefined;
  }
}

class GridSpace<O> implements Space<GridKey, O> {
  readonly kind: SpaceKind = "grid";
  readonly keys: readonly GridKey[];
  readonly #rows: readonly (readonly O[])[];

  constructor(rows: readonly (readonly O[])[]) {
    this.#rows = Object.freeze(rows.map((r) => Object.freeze([...r])));
    const keys: GridKey[] = [];
    this.#rows.forEach((row, i) => row.forEach((_, j) => keys.push(`${i},${j}`)));
    this.keys = Object.freeze(keys);
  }

  has(k: string): k is GridKey {
    return this.coords(k) !== undefined;
  }
  get(k: string): O | undefined {
    const c = this.coords(k);
    return c === undefined ? undefined : this.#rows[c[0] ?? -1]?.[c[1] ?? -1];
  }
  coords(k: string): readonly number[] | undefined {
    const m = /^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/.exec(k);
    if (m === null) return undefined;
    const i = Number(m[1]);
    const j = Number(m[2]);
    const row = this.#rows[i];
    return row !== undefined && j < row.length ? [i, j] : undefined;
  }
  keyAt(coords: readonly number[]): GridKey | undefined {
    const [i, j] = coords;
    if (coords.length !== 2 || i === undefined || j === undefined) return undefined;
    const row = this.#rows[i];
    return row !== undefined && j >= 0 && j < row.length ? `${i},${j}` : undefined;
  }
}

/** The constructors of spaces. */
export const space = {
  /** This function makes a space from the entries of an object. The keys are the property names. */
  record<const R extends Readonly<Record<string, unknown>>>(records: R): Space<keyof R & string, R[keyof R]> {
    return new RecordSpace<keyof R & string, R[keyof R]>(records);
  },
  /** This function makes a space from an array. The keys are `"0"`, `"1"` and so on. */
  array<O>(items: readonly O[]): Space<ArrayKey, O> {
    return new ArraySpace(items);
  },
  /** This function makes a space from rows of cells. The key of a cell is `"row,column"`. */
  grid<O>(rows: readonly (readonly O[])[]): Space<GridKey, O> {
    return new GridSpace(rows);
  },
} as const;

/** The position of an evaluation: the key where it started, and the key where relative references read. */
export interface Position {
  readonly origin: string;
  readonly focus: string;
}

/** This function applies one move to the focus. It gives the new focus, or a `#REF!` error. */
export function applyMove(s: Space, at: Position, m: Move): Result<string> {
  const refError = (kind: "unknown-key" | "not-a-pair" | "out-of-bounds" | "no-offset", message: string): Result<string> =>
    fail(vexError(kind, message, { origin: at.origin, focus: at.focus }));
  switch (m.t) {
    case "key":
      return s.has(m.key) ? ok(m.key) : refError("unknown-key", `the space has no key "${m.key}"`);
    case "index": {
      const k = s.keys[m.i];
      return m.i >= 0 && k !== undefined ? ok(k) : refError("out-of-bounds", `the space has no key at index ${m.i}`);
    }
    case "other": {
      if (s.keys.length !== 2) return refError("not-a-pair", `"other" needs a space with 2 keys, but this space has ${s.keys.length}`);
      const [a, b] = s.keys;
      return ok(at.focus === a ? (b ?? at.focus) : (a ?? at.focus));
    }
    case "offset": {
      const c = s.coords(at.focus);
      if (c === undefined || c.length !== m.d.length) {
        return refError("no-offset", `an offset of ${m.d.length} numbers is not valid in a ${s.kind} space`);
      }
      const target = c.map((x, i) => x + (m.d[i] ?? 0));
      const k = s.keyAt(target);
      return k === undefined ? refError("out-of-bounds", `the offset [${m.d.join(",")}] from "${at.focus}" is outside the space`) : ok(k);
    }
    case "origin":
      return ok(at.origin);
  }
}

/** This function applies the moves of an address in order. It gives the key where the address points. */
export function resolveAddr(s: Space, at: Position, addr: Addr | undefined): Result<string> {
  let focus = at.focus;
  for (const m of addr ?? []) {
    const r = applyMove(s, { origin: at.origin, focus }, m);
    if (!r.ok) return r;
    focus = r.value;
  }
  return ok(focus);
}

const NEIGHBORS_4: readonly (readonly [number, number])[] = [[-1, 0], [0, -1], [0, 1], [1, 0]];
const NEIGHBORS_8: readonly (readonly [number, number])[] = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
];

/**
 * This function gives the targets of a base axis at a focus. It does not handle `where`, because the
 * interpreter must evaluate the test.
 */
export function axisTargets(s: Space, at: Position, a: Exclude<Axis, { readonly t: "where" }>): Result<readonly string[]> {
  switch (a.t) {
    case "all":
      return ok(s.keys);
    case "others":
      return ok(s.keys.filter((k) => k !== at.focus));
    case "other": {
      const r = applyMove(s, at, { t: "other" });
      return r.ok ? ok([r.value]) : r;
    }
    case "neighbors": {
      const c = s.coords(at.focus);
      if (s.kind !== "grid" || c === undefined) {
        return fail(vexError("no-grid", `"neighbors" needs a grid space, but this space is a ${s.kind}`, at));
      }
      const deltas = a.n === 4 ? NEIGHBORS_4 : NEIGHBORS_8;
      const keys: string[] = [];
      for (const [di, dj] of deltas) {
        const k = s.keyAt([(c[0] ?? 0) + di, (c[1] ?? 0) + dj]);
        if (k !== undefined) keys.push(k);
      }
      return ok(keys);
    }
  }
}
