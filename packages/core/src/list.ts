import type { Result } from "./result.ts";

/** One item of a list: the key of the target and the result of the body there. */
export interface ListItem<T = unknown> {
  readonly key: string;
  readonly result: Result<T>;
}

/** The value of an `each` expression: one item for each target of the axis. */
export interface VexList<T = unknown> {
  readonly kind: "vex.list";
  readonly items: readonly ListItem<T>[];
}

/** This function makes a list. */
export const vexList = <T>(items: readonly ListItem<T>[]): VexList<T> => Object.freeze({ kind: "vex.list", items: Object.freeze([...items]) });

/** This function tells if a value is a Vex list. */
export const isVexList = (u: unknown): u is VexList =>
  typeof u === "object" && u !== null && (u as { kind?: unknown }).kind === "vex.list" && Array.isArray((u as { items?: unknown }).items);

/** The names of the core list ops. They apply when the first argument is a list. */
export const LIST_OPS: ReadonlySet<string> = new Set(["count", "sum", "min", "max", "mean", "any", "all", "none", "values", "keys", "reduce", "first", "errors"]);

/** The options of a list op. */
export interface ListOptions {
  /** With `true`, any error item makes the result that error. The default skips error items. */
  readonly strict?: boolean;
}
