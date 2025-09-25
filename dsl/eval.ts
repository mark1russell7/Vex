import type { DomainAdapter, ParamSpec } from "./domain/domain.adapter";
import { ExpressionType } from "./expr/expr.enum";
import type { ArgRef } from "./expr/expr.ir";
import { StepSwitchTo, StepType, type Step } from "./expr/expr.step";
import { Optional, none, some } from "../external/Funk/optional/optional";
import { DSL_OP_META, DSL_OP_META_TABLE, type OpMeta } from "./op.meta";
import type { Scope } from "./scope/scope";
import { LocalMap } from "./params/local.map";
import { ValueKind } from "./value.enum";
import { getFromFocus, getFromPeer } from "./optics.eval";
import type { OLens } from "./optics";

/* ---------------- helpers ---------------- */

function evalArg<D>(
  adapter: DomainAdapter<D>,
  a: ArgRef<D>,
  current: Optional<D>,
  scope?: Scope<D>
): Optional<any> {
  switch (a.t) {
    case ExpressionType.ConstD:     return some(a.v);
    case ExpressionType.ConstS:     return some(a.v);
    case ExpressionType.PropRef:    return scope ? scope.getPropOpt(a.name) : none();
    case ExpressionType.OfRef:      return scope ? scope.getPropOfOpt(a.key, a.prop) : none();
    case ExpressionType.NestedExpr: return adapter && current ? a.expr.build(adapter)(current, scope) : none();
    case ExpressionType.Current:    return current;
  }
}

/** Build a shape for validation mapped to the provided `order` (names → kinds). */
function remapShapeFromParams(
  order: string[] | undefined,
  params: string[] | ParamSpec[] | undefined
): Record<string, ValueKind> | undefined {
  if (!params) return undefined;
  if (Array.isArray(params) && typeof params[0] === "string") return undefined; // names only → unknown kinds

  const specs = params as ParamSpec[];
  if (!order || order.length === 0) {
    const shape: Record<string, ValueKind> = {};
    for (const p of specs) shape[p.name] = p.kind;
    return shape;
  }
  const shape: Record<string, ValueKind> = {};
  const n = Math.min(order.length, specs.length);
  for (let i = 0; i < n; i++) shape[order[i]] = specs[i].kind;
  return shape;
}

/** Validate local map against the shape; in non-strict mode return `false` on mismatch. */
function validateLocalShape<D>(
  local: LocalMap<D>,
  shape: Record<string, ValueKind> | undefined,
  strict: boolean
): { ok: boolean } {
  if (!shape) return { ok: true };
  const ok = local.require(shape);
  if (ok.tag === "Right") return { ok: true };
  if (strict) return { ok: false };
  return { ok: false };
}

/** Extract arguments from local in the given order (Optional). */
function argsFromLocal<D>(local: LocalMap<D>, order: string[], _strict: boolean): Optional<any[]> {
  const vals = local.valuesIn(order);
  if (vals.tag === "Left") return none<any[]>();
  return vals;
}

/** Resolve OpMeta either from the function itself or from a prototype metadata table. */
function resolveMeta(self: any, methodName: string, methodFn: Function): OpMeta | undefined {
  const direct: OpMeta | undefined = (methodFn as any)[DSL_OP_META];
  if (direct) return direct;

  // Walk prototype chain to find a table entry for methodName
  let p = Object.getPrototypeOf(self);
  while (p && p !== Object.prototype) {
    const table = p[DSL_OP_META_TABLE] as Record<string, OpMeta> | undefined;
    if (table && table[methodName]) return table[methodName];
    p = Object.getPrototypeOf(p);
  }
  return undefined;
}

/* ---------------- evaluator ---------------- */

export function evalProgram<D>(
  adapter: DomainAdapter<D>,
  steps: Step<D>[],
  initial: Optional<D>,
  scope?: Scope<D>,
  opts?: { strict?: boolean }
): Optional<any> {
  let cur: Optional<any> = initial;
  let local = new LocalMap<D>();
  const strict = !!opts?.strict;

  const writeIntoLocal = (name: string, v: any): boolean => {
    const entry =
      adapter.isInstance(v) ? ({ tag: "domain", value: v } as const) :
      typeof v === "number"  ? ({ tag: "scalar", value: v } as const) :
      typeof v === "boolean" ? ({ tag: "boolean", value: v } as const) :
      undefined;
    if (!entry) return false;
    local = local.set(name, entry as any);
    return true;
  };

  for (const sAny of steps as any[]) {
    // ---------- local:set (prop/of/expr) ----------
    if (sAny.t === "local:set") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const src = sAny.src;
      if (src.kind === "prop") {
        const ov = scope.getPropOpt(src.prop);
        if (ov.tag === "Left") { if (strict) return none(); cur = none(); continue; }
        writeIntoLocal(sAny.name, ov.right);
      } else if (src.kind === "of") {
        const ov = scope.getPropOfOpt(src.key, src.prop);
        if (ov.tag === "Left") { if (strict) return none(); cur = none(); continue; }
        writeIntoLocal(sAny.name, ov.right);
      } else if (src.kind === "expr") {
        const ev = src.expr.build(adapter)(cur as any, scope, opts);
        if (ev.tag === "Left") { if (strict) return none(); cur = none(); continue; }
        writeIntoLocal(sAny.name, ev.right);
      }
      continue;
    }

    // ---------- local:setLens ----------
    if (sAny.t === "local:setLens") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const oy = sAny.src.focusLens.get(new Proxy({}, {
        get(_t, prop: string) {
          const ov = scope.getPropOpt(prop);
          return ov.tag === "Right" ? ov.right : undefined;
        }
      }));
      if (oy.tag === "Left") { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, oy.right);
      continue;
    }

    // ---------- local:setOptic / local:setPeerOptic ----------
    if (sAny.t === "local:setOptic") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const out = getFromFocus(scope, sAny.optic as OLens<any, any>);
      if (out.tag === "Left") { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, out.right);
      continue;
    }
    if (sAny.t === "local:setPeerOptic") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const out = getFromPeer(scope, sAny.key as string, sAny.optic as OLens<any, any>);
      if (out.tag === "Left") { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, out.right);
      continue;
    }

    // ---------- local:apply ----------
    if (sAny.t === "local:apply") {
      const step: { op: string; order?: string[]; shape?: Record<string, ValueKind> } = sAny;

      // 1) resolve order (prefer explicit)
      let order: string[] | undefined = step.order;
      const params = adapter.methodParams ? adapter.methodParams(step.op) : undefined;
      if (!order || order.length === 0) {
        if (params && Array.isArray(params) && typeof params[0] === "string") {
          order = params as string[];
        } else if (params && Array.isArray(params) && typeof params[0] !== "string") {
          order = (params as ParamSpec[]).map(p => p.name);
        } else {
          if (strict) return none();
          cur = none(); continue;
        }
      }

      // 2) build & validate effective shape
      const effectiveShape =
        step.shape ??
        remapShapeFromParams(order, params);
      const okShape = validateLocalShape(local, effectiveShape, strict);
      if (!okShape.ok) { if (strict) return none(); cur = none(); continue; }

      // 3) extract args
      const vals = argsFromLocal(local, order, strict);
      if (vals.tag === "Left") { if (strict) return none(); cur = none(); continue; }
      let callArgs: any[] = vals.right;

      // 4) resolve self & method
      if (!(cur.tag === "Right") || !adapter.isInstance(cur.right)) { if (strict) return none(); cur = none(); continue; }
      const self = cur.right;
      const method = adapter.getMethod(self, step.op);
      if (!method) { if (strict) return none(); cur = none(); continue; }

      // 5) scalar lift with (meta lookup)
      const meta = resolveMeta(self, step.op, method);
      if (meta?.liftScalar && adapter.fromScalar) {
        callArgs = callArgs.map((a, i) => {
          if (typeof a === "number") {
            if (meta.liftScalar === true) return adapter.fromScalar!(a);
            if (Array.isArray(meta.liftScalar) && meta.liftScalar[i]) return adapter.fromScalar!(a);
          }
          return a;
        });
      }

      // 6) call
      try { cur = some(method.apply(self, callArgs)); }
      catch { cur = none(); }
      continue;
    }

    // ---------- local:partial ----------
    if (sAny.t === "local:partial") {
      const step: { op: string; subsetOrder: string[]; storeAs: string } = sAny;

      if (!(cur.tag === "Right") || !adapter.isInstance(cur.right)) { if (strict) return none(); cur = none(); continue; }
      if (!adapter.partial) { if (strict) return none(); cur = none(); continue; }

      const vals = argsFromLocal(local, step.subsetOrder, strict);
      if (vals.tag === "Left") { if (strict) return none(); cur = none(); continue; }

      try {
        const closed = adapter.partial(cur.right, step.op, step.subsetOrder, vals.right);
        local = local.set(step.storeAs, { tag: "domain", value: closed } as any);
      } catch { if (strict) return none(); }
      continue;
    }

    // ---------- local:setConst ----------
    if ((sAny as any).t === "local:setConst") {
      const { name, value } = sAny as { name: string; value: any };
      if (!writeIntoLocal(name, value)) { if (strict) return none(); cur = none(); }
      continue;
    }

    // ---------- Switch ----------
    if (sAny.t === StepType.Switch) {
      if (!scope) return none();
      if (sAny.to === StepSwitchTo.Self) {
        if (typeof sAny.key === "string") scope.setFocusByKey(sAny.key);
        else if (typeof sAny.key === "number") scope.setFocusByIndex(sAny.key);
      } else if (sAny.to === StepSwitchTo.Other) {
        if (sAny.key != null) {
          if (typeof sAny.key === "string") scope.setFocusByKey(String(sAny.key));
          else scope.setFocusByIndex(Number(sAny.key));
        } else scope.setFocusToOther();
      } else if (sAny.to === StepSwitchTo.Key) {
        scope.setFocusByKey(String(sAny.key));
      } else {
        scope.setFocusByIndex(Number(sAny.key));
      }
      continue;
    }

    // ---------- Select ----------
    if (sAny.t === StepType.Select) {
      if (!scope) return none();
      cur = scope.getPropOpt(sAny.prop);
      if (strict && cur.tag === "Left") return none();
      continue;
    }

    // ---------- Invoke (normal IR) ----------
    if (sAny.t === StepType.Invoke) {
      if (!(cur.tag === "Right") || !adapter.isInstance(cur.right)) { cur = none(); continue; }
      const self = cur.right;
      const method = adapter.getMethod(self, sAny.op);
      if (!method) { cur = none(); continue; }

      const argOpts = (sAny.args as ArgRef<D>[]).map(a => evalArg(adapter, a, cur as Optional<D>, scope));
      const gathered: any[] = [];
      let bad = false;
      for (const o of argOpts) {
        if (o.tag === "Left") { bad = true; break; }
        gathered.push((o as any).right);
      }
      if (bad) { if (strict) return none(); cur = none(); continue; }

      // (meta lookup)
      const meta = resolveMeta(self, sAny.op, method);
      const callArgs = ((): any[] => {
        const lift = meta?.liftScalar;
        if (!lift || !adapter.fromScalar) return gathered;
        return gathered.map((a, i) => {
          if (typeof a === "number") {
            if (lift === true) return adapter.fromScalar!(a);
            if (Array.isArray(lift) && lift[i]) return adapter.fromScalar!(a);
          }
          return a;
        });
      })();

      try { cur = some(method.apply(self, callArgs)); }
      catch { cur = none(); }
      continue;
    }
  }

  return cur;
}
