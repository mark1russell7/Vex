import { liftsAt, resolveOp, type AnyDomain, type ParamKind, type ResolvedOp } from "./domain.ts";
import { formatError, vexError, type ErrorKind, type VexError } from "./errors.ts";
import { children, type Axis, type Expr, type ExprOf } from "./ir.ts";
import { isListOp, isVexList, vexList, type ListItem, type ListOp, type ListOptions, type VexList } from "./list.ts";
import { fail, ok, type Result } from "./result.ts";
import { axisTargets, resolveAddr, type Position, type Space } from "./space.ts";
import type { Read, Trace, TraceEvent, TraceSink } from "./trace.ts";

/** A free function op. The interpreter gives it the values of all arguments. */
export type FreeFn = (...args: readonly unknown[]) => unknown;

/** The context of an extension handler. */
export interface ExtContext {
  readonly space: Space;
  readonly position: Position;
  readonly path: readonly number[];
}

/** The handler of an extension expression kind. */
export type ExtHandler = (data: unknown, ctx: ExtContext) => Result<unknown>;

/** The options of an evaluation. */
export interface EvalOptions {
  /** The space that the program reads. */
  readonly space: Space;
  /** The key where the evaluation starts. Relative references read here. */
  readonly origin: string;
  /** The domains. The interpreter finds the op of a value in the first domain that accepts the value. */
  readonly domains?: readonly AnyDomain[];
  /** Free function ops, for ops that are not domain ops. */
  readonly fns?: Readonly<Record<string, FreeFn>>;
  /** The handlers of extension expression kinds. */
  readonly extensions?: Readonly<Record<string, ExtHandler>>;
  /** Variables that the program can read with `v(name)`. */
  readonly vars?: Readonly<Record<string, unknown>>;
  /** A receiver of trace events. */
  readonly trace?: TraceSink;
}

type Env = ReadonlyMap<string, Result<unknown>>;

interface Frame {
  readonly pos: Position;
  readonly env: Env;
}

/** The name of a special form. */
export type SpecialForm = "if" | "and" | "or" | "ifError";

/** The names of the special forms. Their arguments are not evaluated before the call. */
export const SPECIAL_FORMS: ReadonlySet<string> = new Set<SpecialForm>(["if", "and", "or", "ifError"]);

const isSpecialForm = (op: string): op is SpecialForm => SPECIAL_FORMS.has(op);

/** This function evaluates an expression at the origin of a space. It does not throw. */
export function evaluate(expr: Expr, opts: EvalOptions): Result<unknown> {
  return new Interpreter(opts).run(expr);
}

/** This function evaluates an expression and records a trace of each node. */
export function explain(expr: Expr, opts: Omit<EvalOptions, "trace">): Trace {
  const sink: TraceSink = { events: [] };
  const result = new Interpreter({ ...opts, trace: sink }).run(expr);
  return { events: sink.events, result };
}

class Interpreter {
  readonly #opts: EvalOptions;
  readonly #domains: readonly AnyDomain[];

  constructor(opts: EvalOptions) {
    this.#opts = opts;
    this.#domains = opts.domains ?? [];
  }

  run(expr: Expr): Result<unknown> {
    const { space, origin } = this.#opts;
    if (!space.has(origin)) {
      return fail(vexError("unknown-key", `the space has no key "${origin}"`, { origin, focus: origin }));
    }
    const env = new Map<string, Result<unknown>>(Object.entries(this.#opts.vars ?? {}).map(([k, val]) => [k, ok(val)]));
    try {
      return this.#ev(expr, { pos: { origin, focus: origin }, env }, []);
    } catch (thrown) {
      // A defect in an extension handler or in a test of the interpreter itself. Totality still holds.
      return fail(vexError("threw", "the evaluation threw an exception", { origin, focus: origin, thrown }));
    }
  }

  #err(kind: ErrorKind, message: string, f: Frame, path: readonly number[], extra: { op?: string; causes?: readonly VexError[]; thrown?: unknown } = {}): Result<never> {
    return fail(vexError(kind, message, { path, origin: f.pos.origin, focus: f.pos.focus, ...extra }));
  }

  #emit(e: Expr, f: Frame, path: readonly number[], result: Result<unknown>, reads?: readonly Read[]): Result<unknown> {
    const sink = this.#opts.trace;
    if (sink !== undefined) {
      const event: TraceEvent = {
        path,
        tag: e.tag,
        label: labelOf(e),
        origin: f.pos.origin,
        focus: f.pos.focus,
        ...(reads === undefined ? {} : { reads }),
        result,
      };
      sink.events.push(event);
    }
    return result;
  }

  #ev(e: Expr, f: Frame, path: readonly number[]): Result<unknown> {
    switch (e.tag) {
      case "lit":
        return this.#emit(e, f, path, ok(e.value));
      case "ref":
        return this.#ref(e, f, path);
      case "var": {
        const bound = f.env.get(e.name);
        const r = bound ?? this.#err("unbound", `the name "${e.name}" has no binding`, f, path);
        return this.#emit(e, f, path, r);
      }
      case "let": {
        const env = new Map(f.env);
        const binds = Object.entries(e.bind);
        binds.forEach(([name, be], i) => env.set(name, this.#ev(be, f, [...path, i])));
        const r = this.#ev(e.body, { pos: f.pos, env }, [...path, binds.length]);
        return this.#emit(e, f, path, r);
      }
      case "rec":
        return this.#emit(e, f, path, this.#rec(e, f, path));
      case "app":
        return this.#emit(e, f, path, this.#app(e, f, path));
      case "each":
        return this.#emit(e, f, path, this.#each(e, f, path));
      case "ext": {
        const handler = this.#opts.extensions?.[e.kind];
        const r =
          handler === undefined
            ? this.#err("unknown-op", `no handler for the extension kind "${e.kind}"`, f, path)
            : this.#guard(() => handler(e.data, { space: this.#opts.space, position: f.pos, path }), f, path, e.kind);
        return this.#emit(e, f, path, r);
      }
    }
  }

  #guard(run: () => Result<unknown>, f: Frame, path: readonly number[], op: string): Result<unknown> {
    try {
      return run();
    } catch (thrown) {
      return this.#err("threw", `"${op}" threw an exception`, f, path, { op, thrown });
    }
  }

  #ref(e: ExprOf<"ref">, f: Frame, path: readonly number[]): Result<unknown> {
    const where = resolveAddr(this.#opts.space, f.pos, e.at);
    if (!where.ok) return this.#emit(e, f, path, fail({ ...where.error, path }));
    const key = where.value;
    let value: unknown = this.#opts.space.get(key);
    const label = e.path.join(".");
    const missing = (at: string): Result<unknown> =>
      this.#err("missing-field", `the record at "${key}" has no value at "${at}"`, f, path);
    if (value === undefined || value === null) {
      return this.#emit(e, f, path, missing(label === "" ? "(record)" : label), [{ key, path: e.path, ok: false }]);
    }
    for (const [i, seg] of e.path.entries()) {
      const at = e.path.slice(0, i + 1).join(".");
      if ((typeof value !== "object" && typeof value !== "function") || !isFieldName(seg)) {
        return this.#emit(e, f, path, missing(at), [{ key, path: e.path, ok: false }]);
      }
      try {
        value = Reflect.get(value, seg);
      } catch (thrown) {
        return this.#emit(e, f, path, this.#err("threw", `reading "${at}" at "${key}" threw an exception`, f, path, { thrown }), [
          { key, path: e.path, ok: false },
        ]);
      }
      if (value === undefined || value === null) {
        return this.#emit(e, f, path, missing(at), [{ key, path: e.path, ok: false }]);
      }
    }
    return this.#emit(e, f, path, ok(value), [{ key, path: e.path, ok: true }]);
  }

  /** This method evaluates expressions applicatively. One failure stays as it is. Two or more give `#ARGS`. */
  #all(exprs: readonly Expr[], f: Frame, path: readonly number[], what: string): Result<readonly unknown[]> {
    const results = exprs.map((x, i) => this.#ev(x, f, [...path, i]));
    const errors = results.flatMap((r) => (r.ok ? [] : [r.error]));
    const [first] = errors;
    if (first === undefined) return ok(results.map((r) => (r.ok ? r.value : undefined)));
    return errors.length === 1 ? fail(first) : this.#err("args", `${errors.length} ${what} failed`, f, path, { causes: errors });
  }

  #rec(e: ExprOf<"rec">, f: Frame, path: readonly number[]): Result<unknown> {
    const names = Object.keys(e.fields);
    const values = this.#all(
      names.map((n) => e.fields[n] as Expr),
      f,
      path,
      "fields",
    );
    if (!values.ok) return values;
    const out: Record<string, unknown> = {};
    names.forEach((n, i) => {
      out[n] = values.value[i];
    });
    return ok(Object.freeze(out));
  }

  #each(e: ExprOf<"each">, f: Frame, path: readonly number[]): Result<unknown> {
    const targets = this.#targets(e.axis, f, path, { next: 1 });
    if (!targets.ok) return targets;
    const items: ListItem[] = targets.value.map(({ key, test }) => {
      if (test !== undefined && !test.ok) return { key, result: test };
      const result = this.#ev(e.body, { pos: { origin: f.pos.origin, focus: key }, env: f.env }, [...path, 0]);
      return { key, result };
    });
    return ok(vexList(items));
  }

  /** This method gives the targets of an axis. For `where`, a failed test keeps the target with its error. */
  #targets(
    a: Axis,
    f: Frame,
    path: readonly number[],
    counter: { next: number },
  ): Result<readonly { readonly key: string; readonly test?: Result<unknown> }[]> {
    if (a.t !== "where") {
      const keys = axisTargets(this.#opts.space, f.pos, a);
      return keys.ok ? ok(keys.value.map((key) => ({ key }))) : fail({ ...keys.error, path });
    }
    const inner = this.#targets(a.axis, f, path, counter);
    if (!inner.ok) return inner;
    const testIndex = counter.next++;
    const out: { key: string; test?: Result<unknown> }[] = [];
    for (const t of inner.value) {
      if (t.test !== undefined && !t.test.ok) {
        out.push(t);
        continue;
      }
      const r = this.#ev(a.test, { pos: { origin: f.pos.origin, focus: t.key }, env: f.env }, [...path, testIndex]);
      if (!r.ok) out.push({ key: t.key, test: r });
      else if (r.value === true) out.push({ key: t.key });
      else if (r.value !== false) {
        out.push({ key: t.key, test: this.#err("kind-mismatch", `the test of "where" gave a ${typeof r.value}, not a boolean`, f, [...path, testIndex]) });
      }
    }
    return ok(out);
  }

  #app(e: ExprOf<"app">, f: Frame, path: readonly number[]): Result<unknown> {
    if (isSpecialForm(e.op)) return this.#special(e, e.op, f, path);
    const args = this.#all(e.args, f, path, "arguments");
    if (!args.ok) return args;
    const values = args.value;
    const self = values[0];

    if (isVexList(self) && isListOp(e.op)) return this.#listOp(e.op, self, values.slice(1), f, path);

    let accepted: AnyDomain | undefined;
    if (values.length > 0) {
      for (const d of this.#domains) {
        if (!safeIs(d, self)) continue;
        accepted ??= d;
        const op = resolveOp(d, self, e.op);
        if (op !== undefined) return this.#call(op, e.op, values.slice(1), f, path);
      }
    }
    const fn = this.#opts.fns?.[e.op];
    if (fn !== undefined && Object.hasOwn(this.#opts.fns ?? {}, e.op)) {
      return this.#checkResult(this.#invoke(() => fn(...values), e.op, f, path), f, path, e.op);
    }
    if (accepted !== undefined) return this.#err("unknown-op", `the domain "${accepted.name}" has no op "${e.op}"`, f, path, { op: e.op });
    if (values.length === 0) return this.#err("unknown-op", `there is no function "${e.op}"`, f, path, { op: e.op });
    return this.#err("not-instance", `no domain accepts the receiver of "${e.op}" (${describeType(self)})`, f, path, { op: e.op });
  }

  #call(op: ResolvedOp, name: string, rest: readonly unknown[], f: Frame, path: readonly number[]): Result<unknown> {
    const { domain, spec } = op;
    const lift = spec.liftScalar;
    const from = domain.fromScalar;
    let callArgs: readonly unknown[] = rest;
    if (lift !== undefined && lift !== false && from !== undefined) {
      const lifted = this.#invoke(() => rest.map((a, i): unknown => (typeof a === "number" && liftsAt(lift, i) ? from(a) : a)), `${domain.name}.fromScalar`, f, path);
      if (!lifted.ok) return lifted;
      callArgs = lifted.value as readonly unknown[];
    }
    if (spec.params !== undefined) {
      for (let i = 0; i < callArgs.length; i++) {
        const kind = spec.params[i] ?? "any";
        if (!matchesKind(kind, callArgs[i], domain)) {
          const k: ErrorKind = kind === "domain" ? "not-instance" : "kind-mismatch";
          return this.#err(k, `argument ${i + 1} of "${name}" is a ${describeType(callArgs[i])}, not a ${kind === "domain" ? domain.name : kind}`, f, path, { op: name });
        }
      }
    }
    return this.#checkResult(this.#invoke(() => op.call(callArgs), name, f, path), f, path, name);
  }

  #invoke(run: () => unknown, op: string, f: Frame, path: readonly number[]): Result<unknown> {
    try {
      return ok(run());
    } catch (thrown) {
      return this.#err("threw", `"${op}" threw an exception`, f, path, { op, thrown });
    }
  }

  /** This method checks the value that an op gave: no `undefined`, finite numbers, and valid domain values. */
  #checkResult(r: Result<unknown>, f: Frame, path: readonly number[], op: string): Result<unknown> {
    if (!r.ok) return r;
    const value = r.value;
    const extra = { op };
    if (value === undefined || value === null) return this.#err("undefined-result", `"${op}" gave no value`, f, path, extra);
    if (typeof value === "number" && !Number.isFinite(value)) return this.#err("not-finite", `"${op}" gave ${value}`, f, path, extra);
    const d = this.#domains.find((dom) => safeIs(dom, value));
    if (d?.valid !== undefined) {
      let valid: boolean;
      try {
        valid = d.valid(value);
      } catch (thrown) {
        return this.#err("threw", `the "valid" check of "${d.name}" threw an exception`, f, path, { ...extra, thrown });
      }
      if (!valid) return this.#err("invalid-value", `"${op}" gave a value that is not a valid ${d.name}`, f, path, extra);
    }
    return r;
  }

  #special(e: ExprOf<"app">, op: SpecialForm, f: Frame, path: readonly number[]): Result<unknown> {
    const arg = (i: number): Result<unknown> => {
      const x = e.args[i];
      return x === undefined ? this.#err("bad-expression", `"${op}" needs argument ${i + 1}`, f, path, { op: op }) : this.#ev(x, f, [...path, i]);
    };
    const bool = (i: number): Result<boolean> => {
      const r = arg(i);
      if (!r.ok) return r;
      return typeof r.value === "boolean" ? ok(r.value) : this.#err("kind-mismatch", `argument ${i + 1} of "${op}" is a ${describeType(r.value)}, not a boolean`, f, path, { op: op });
    };
    switch (op) {
      case "if": {
        const c = bool(0);
        if (!c.ok) return c;
        return arg(c.value ? 1 : 2);
      }
      case "and":
      case "or": {
        if (e.args.length === 0) return this.#err("bad-expression", `"${op}" needs at least 1 argument`, f, path, { op: op });
        for (let i = 0; i < e.args.length; i++) {
          const b = bool(i);
          if (!b.ok) return b;
          if (op === "and" ? !b.value : b.value) return ok(b.value);
        }
        return ok(op === "and");
      }
      case "ifError": {
        const first = arg(0);
        return first.ok ? first : arg(1);
      }
    }
  }

  #listOp(op: ListOp, list: VexList, rest: readonly unknown[], f: Frame, path: readonly number[]): Result<unknown> {
    const optsArg = op === "reduce" ? rest[1] : rest[0];
    const strict = isOptions(optsArg) && optsArg.strict === true;
    const firstError = list.items.find((it) => !it.result.ok)?.result;
    if (strict && firstError !== undefined && !firstError.ok) return fail(firstError.error);
    const okValues = list.items.flatMap((it) => (it.result.ok ? [it.result.value] : []));
    const numbers = (): Result<readonly number[]> => {
      const bad = okValues.find((x) => typeof x !== "number");
      return bad === undefined ? ok(okValues as readonly number[]) : this.#err("kind-mismatch", `"${op}" needs numbers, but an item is a ${describeType(bad)}`, f, path, { op });
    };
    const booleans = (): Result<readonly boolean[]> => {
      const bad = okValues.find((x) => typeof x !== "boolean");
      return bad === undefined ? ok(okValues as readonly boolean[]) : this.#err("kind-mismatch", `"${op}" needs booleans, but an item is a ${describeType(bad)}`, f, path, { op });
    };
    const empty = (): Result<never> => this.#err("empty", `"${op}" has no values to work with`, f, path, { op });
    switch (op) {
      case "count":
        return ok(okValues.length);
      case "values":
        return ok(Object.freeze([...okValues]));
      case "keys":
        return ok(Object.freeze(list.items.filter((it) => it.result.ok).map((it) => it.key)));
      case "errors":
        return ok(Object.freeze(list.items.flatMap((it) => (it.result.ok ? [] : [it.result.error]))));
      case "first":
        return okValues.length > 0 ? ok(okValues[0]) : empty();
      case "sum": {
        const n = numbers();
        return n.ok ? this.#checkResult(ok(n.value.reduce((s, x) => s + x, 0)), f, path, op) : n;
      }
      case "mean": {
        const n = numbers();
        if (!n.ok) return n;
        return n.value.length === 0 ? empty() : this.#checkResult(ok(n.value.reduce((s, x) => s + x, 0) / n.value.length), f, path, op);
      }
      case "min":
      case "max": {
        const n = numbers();
        if (!n.ok) return n;
        if (n.value.length === 0) return empty();
        return ok(n.value.reduce((best, x) => (op === "min" ? Math.min(best, x) : Math.max(best, x))));
      }
      case "any":
      case "all":
      case "none": {
        const b = booleans();
        if (!b.ok) return b;
        if (op === "any") return ok(b.value.some((x) => x));
        if (op === "all") return ok(b.value.every((x) => x));
        return ok(!b.value.some((x) => x));
      }
      case "reduce":
        return this.#reduce(rest[0], okValues, f, path);
    }
  }

  /** This method folds the values with a domain op, from the left. An empty list gives the identity of the op. */
  #reduce(opName: unknown, values: readonly unknown[], f: Frame, path: readonly number[]): Result<unknown> {
    if (typeof opName !== "string") return this.#err("kind-mismatch", `"reduce" needs an op name, but got a ${describeType(opName)}`, f, path, { op: "reduce" });
    if (values.length === 0) {
      for (const d of this.#domains) {
        const id = (d.ops[opName] as { identity?: () => unknown } | undefined)?.identity;
        if (id !== undefined && Object.hasOwn(d.ops, opName)) return this.#invoke(id, opName, f, path);
      }
      return this.#err("empty", `"reduce" with "${opName}" has no values and the op has no identity`, f, path, { op: opName });
    }
    let acc: unknown = values[0];
    for (let i = 1; i < values.length; i++) {
      const d = this.#domains.find((dom) => safeIs(dom, acc) && resolveOp(dom, acc, opName) !== undefined);
      const op = d === undefined ? undefined : resolveOp(d, acc, opName);
      if (op === undefined) return this.#err("unknown-op", `no domain gives "${opName}" for a ${describeType(acc)}`, f, path, { op: opName });
      const r = this.#call(op, opName, [values[i]], f, path);
      if (!r.ok) return r;
      acc = r.value;
    }
    return ok(acc);
  }
}

const FORBIDDEN_FIELDS = new Set(["__proto__", "constructor", "prototype"]);
const isFieldName = (seg: string): boolean => seg.length > 0 && !FORBIDDEN_FIELDS.has(seg);

/** This function runs the `is` test of a domain. A test that throws counts as `false`. */
function safeIs(d: AnyDomain, value: unknown): boolean {
  try {
    return d.is(value);
  } catch {
    return false;
  }
}

const isOptions = (u: unknown): u is ListOptions => typeof u === "object" && u !== null && !Array.isArray(u) && !isVexList(u);

function matchesKind(kind: ParamKind, value: unknown, domain: AnyDomain): boolean {
  switch (kind) {
    case "domain":
      return safeIs(domain, value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "string":
      return typeof value === "string";
    case "any":
      return true;
  }
}

/** This function gives a short name for the type of a value, for error messages. */
export function describeType(u: unknown): string {
  if (u === null) return "null";
  if (Array.isArray(u)) return "array";
  if (isVexList(u)) return "list";
  if (typeof u === "object") {
    const name = (Object.getPrototypeOf(u) as { constructor?: { name?: unknown } } | null)?.constructor?.name;
    return typeof name === "string" && name !== "Object" ? name : "object";
  }
  return typeof u;
}

/** This function gives the label of a node, for traces. */
export function labelOf(e: Expr): string {
  switch (e.tag) {
    case "lit":
      return previewValue(e.value);
    case "ref":
      return e.path.length === 0 ? "(record)" : e.path.join(".");
    case "app":
      return e.op;
    case "let":
      return `let ${Object.keys(e.bind).join(", ")}`;
    case "var":
      return e.name;
    case "rec":
      return `{ ${Object.keys(e.fields).join(", ")} }`;
    case "each":
      return `each ${e.axis.t}`;
    case "ext":
      return e.kind;
  }
}

/** This function gives a short text for a value. */
export function previewValue(u: unknown): string {
  if (typeof u === "string") return JSON.stringify(u);
  if (typeof u === "number" || typeof u === "boolean" || u === null || u === undefined) return String(u);
  if (isVexList(u)) return `list(${u.items.length})`;
  try {
    const json = JSON.stringify(u);
    if (json !== undefined) return json.length > 60 ? `${json.slice(0, 57)}...` : json;
  } catch {
    // A value with cycles has no JSON form.
  }
  return describeType(u);
}

/**
 * This function gives a text form of a trace. Each event has one line, in finish order. The indent of a line
 * shows the depth of the node. A domain with `show` gives the text of its values. The golden tests compare this text.
 */
export function formatTrace(trace: Trace, domains: readonly AnyDomain[] = []): string {
  const show = (u: unknown): string => {
    if (isVexList(u)) return `[${u.items.map((it) => `${it.key}: ${result(it.result)}`).join(", ")}]`;
    const d = domains.find((dom) => dom.show !== undefined && safeIs(dom, u));
    try {
      if (d?.show !== undefined) return d.show(u);
    } catch {
      // A show function that throws gives the default text.
    }
    return previewValue(u);
  };
  const result = (r: Result<unknown>): string => (r.ok ? show(r.value) : formatError(r.error));
  const line = (e: TraceEvent): string => {
    // A reference with an address reads at another key. The line names that key.
    const moved = e.reads?.find((r) => r.key !== e.focus);
    return `${"  ".repeat(e.path.length)}${e.label} @${moved === undefined ? e.focus : `${e.focus} -> ${moved.key}`} = ${result(e.result)}`;
  };
  const lines = trace.events.map(line);
  return [...lines, `result = ${result(trace.result)}`, ""].join("\n");
}

/** This function gives the number of nodes of an expression. */
export const sizeOf = (e: Expr): number => 1 + children(e).reduce((s, c) => s + sizeOf(c), 0);
