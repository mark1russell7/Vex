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
  readonly #items: ReadonlyMap<string, O>;

  constructor(items: readonly O[]) {
    const entries = items.map((item, i): [ArrayKey, O] => [`${i}`, item]);
    this.keys = Object.freeze(entries.map(([k]) => k));
    this.#items = new Map(entries);
  }

  has(k: string): k is ArrayKey {
    return this.#items.has(k);
  }
  get(k: string): O | undefined {
    return this.#items.get(k);
  }
  coords(k: string): readonly number[] | undefined {
    return this.has(k) ? [Number(k)] : undefined;
  }
  keyAt(coords: readonly number[]): ArrayKey | undefined {
    const k = coords.join(",");
    return coords.length === 1 && this.has(k) ? k : undefined;
  }
}

class GridSpace<O> implements Space<GridKey, O> {
  readonly kind: SpaceKind = "grid";
  readonly keys: readonly GridKey[];
  readonly #cells: ReadonlyMap<string, O>;

  constructor(rows: readonly (readonly O[])[]) {
    const entries = rows.flatMap((row, i) => row.map((cell, j): [GridKey, O] => [`${i},${j}`, cell]));
    this.keys = Object.freeze(entries.map(([k]) => k));
    this.#cells = new Map(entries);
  }

  has(k: string): k is GridKey {
    return this.#cells.has(k);
  }
  get(k: string): O | undefined {
    return this.#cells.get(k);
  }
  coords(k: string): readonly number[] | undefined {
    return this.has(k) ? k.split(",").map(Number) : undefined;
  }
  keyAt(coords: readonly number[]): GridKey | undefined {
    const k = coords.join(",");
    return coords.length === 2 && this.has(k) ? k : undefined;
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
      // A pair has two keys, so `a` and `b` are defined.
      /* v8 ignore next -- @preserve */
      return ok(at.focus === a ? (b ?? at.focus) : (a ?? at.focus));
    }
    case "offset": {
      const c = s.coords(at.focus);
      if (c === undefined || c.length !== m.d.length) {
        return refError("no-offset", `an offset of ${m.d.length} numbers is not valid in a ${s.kind} space`);
      }
      // The lengths are equal, so each index of `c` is also an index of `m.d`.
      /* v8 ignore next -- @preserve */
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
      if (s.kind !== "grid") return fail(vexError("no-grid", `"neighbors" needs a grid space, but this space is a ${s.kind}`, at));
      const deltas = a.n === 4 ? NEIGHBORS_4 : NEIGHBORS_8;
      return ok(
        deltas.flatMap((d) => {
          const r = applyMove(s, at, { t: "offset", d });
          return r.ok ? [r.value] : [];
        }),
      );
    }
  }
}
