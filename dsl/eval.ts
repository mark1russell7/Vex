import type { DomainAdapter, ParamSpec } from "./domain/domain.adapter";
import { ExpressionType } from "./expr/expr.enum";
import type { ArgRef } from "./expr/expr.ir";
import { StepSwitchTo, StepType, type Step } from "./expr/expr.step";
import { Optional, none, some, isFound } from "../external/Funk/optional/optional";
import { fold as foldEither } from "../external/Funk/optional/either";
import { DSL_OP_META, DSL_OP_META_TABLE, type OpMeta } from "./op.meta";
import type { Scope } from "./scope/scope";
import { LocalMap } from "./params/local.map";
import { ValueKind } from "./value.enum";
import { getFromFocus, getFromPeer } from "./optics.eval";
import type { OLens } from "./optics";
import { NDVector } from "../math/vector/ndvector";

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
    case ExpressionType.NestedExpr: return scope ? a.expr.build(adapter)(current, scope) : none();
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
  return isFound(ok) ? { ok: true } : { ok: false && strict };
}

/** Extract arguments from local in the given order (Optional). */
function argsFromLocal<D>(local: LocalMap<D>, order: string[]): Optional<any[]> {
  return local.valuesIn(order);
}

/** Resolve OpMeta either from the function itself or from a prototype metadata table. */
function resolveMeta(self: any, methodName: string, methodFn: Function): OpMeta | undefined {
  const direct: OpMeta | undefined = (methodFn as any)[DSL_OP_META];
  if (direct) return direct;

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
      adapter.isInstance(v) ? ({ tag: "domain",  value: v } as const) :
      typeof v === "number"  ? ({ tag: "scalar",  value: v } as const) :
      typeof v === "boolean" ? ({ tag: "boolean", value: v } as const) :
      ({ tag: "any", value: v } as const);  // NEW: store other values (e.g., functions)

    local = local.set(name, entry as any);
    return true;
  };


  for (const sAny of steps as any[]) {
    // ---------- local:set (prop/of/expr) ----------
    if (sAny.t === "local:set") {
      if (!scope) { return strict ? none() : (cur = none()); }
      const src = sAny.src;

      if (src.kind === "prop") {
        const ov = scope.getPropOpt(src.prop);
        if (!isFound(ov)) { if (strict) return none(); cur = none(); continue; }
        writeIntoLocal(sAny.name, foldEither(ov, () => null, r => r));
      } else if (src.kind === "of") {
        const ov = scope.getPropOfOpt(src.key, src.prop);
        if (!isFound(ov)) { if (strict) return none(); cur = none(); continue; }
        writeIntoLocal(sAny.name, foldEither(ov, () => null, r => r));
      } else if (src.kind === "expr") {
        const ev = src.expr.build(adapter)(cur as any, scope, opts);
        if (!isFound(ev)) { if (strict) return none(); cur = none(); continue; }
        writeIntoLocal(sAny.name, foldEither(ev, () => null, r => r));
      }
      continue;
    }

    // ---------- local:setLens ----------
    if (sAny.t === "local:setLens") {
      if (!scope) { return strict ? none() : (cur = none()); }
      const oy = sAny.src.focusLens.get(new Proxy({}, {
        get(_t, prop: string) {
          const ov = scope.getRawPropOpt(prop);
          return foldEither(ov, () => undefined, r => r);
        }
      }));
      if (!isFound(oy)) { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, foldEither(oy, () => null, r => r));
      continue;
    }

    // ---------- local:setOptic / local:setPeerOptic ----------
    if (sAny.t === "local:setOptic") {
      if (!scope) { return strict ? none() : (cur = none()); }
      const out = getFromFocus(scope, sAny.optic as OLens<any, any>);
      if (!isFound(out)) { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, foldEither(out, () => null, r => r));
      continue;
    }
    if (sAny.t === "local:setPeerOptic") {
      if (!scope) { return strict ? none() : (cur = none()); }
      const out = getFromPeer(scope, sAny.key as string, sAny.optic as OLens<any, any>);
      if (!isFound(out)) { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, foldEither(out, () => null, r => r));
      continue;
    }
      // ---------- local:setNDVFromOptics ----------
    if (sAny.t === "local:setNDVFromOptics") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const fields: Record<string, OLens<any, number>> = sAny.fields;
      const obj: Record<string, number> = {};
      let bad = false;

      for (const key of Object.keys(fields)) {
        const out = getFromFocus(scope, fields[key]); // Optional<number>
        if (!isFound(out)) { bad = true; break; }
        const v = foldEither(out, () => NaN, r => r);
        if (typeof v !== "number" || !Number.isFinite(v)) { bad = true; break; }
        obj[key] = v;
      }

      if (bad) { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, new NDVector(obj));
      continue;
    }

    // ---------- local:setNDVFromPeerOptics ----------
    if (sAny.t === "local:setNDVFromPeerOptics") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const { peer, fields } = sAny as { peer: string; fields: Record<string, OLens<any, number>> };
      const obj: Record<string, number> = {};
      let bad = false;

      for (const key of Object.keys(fields)) {
        const out = getFromPeer(scope, peer, fields[key]); // Optional<number>
        if (!isFound(out)) { bad = true; break; }
        const v = foldEither(out, () => NaN, r => r);
        if (typeof v !== "number" || !Number.isFinite(v)) { bad = true; break; }
        obj[key] = v;
      }

      if (bad) { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, new NDVector(obj));
      continue;
    }

    if (sAny.t === "local:setNDVFromPeers") {
      if (!scope) { if (strict) return none(); cur = none(); continue; }
      const { spec } = sAny as { spec: Record<string, { peer: string; lens: OLens<any, number> }> };
      const obj: Record<string, number> = {};
      let bad = false;

      for (const key of Object.keys(spec)) {
        const { peer, lens } = spec[key];
        const out = getFromPeer(scope, peer, lens);
        if (!isFound(out)) { bad = true; break; }
        const v = foldEither(out, () => NaN, r => r);
        if (typeof v !== "number" || !Number.isFinite(v)) { bad = true; break; }
        obj[key] = v;
      }

      if (bad) { if (strict) return none(); cur = none(); continue; }
      writeIntoLocal(sAny.name, new NDVector(obj));
      continue;
    }



    // ---------- local:apply ----------
    if (sAny.t === "local:apply") {
      const step: { op: string; order?: string[]; shape?: Record<string, ValueKind> } = sAny;

      // 1) resolve order (prefer explicit)
      let order: string[] | undefined = step.order;
      const params = adapter.methodParams ? adapter.methodParams(step.op) : undefined;
      if (!order || order.length === 0) {
        if (Array.isArray(params) && typeof params[0] === "string") {
          order = params as string[];
        } else if (Array.isArray(params) && typeof params[0] !== "string") {
          order = (params as ParamSpec[]).map(p => p.name);
        } else {
          return strict ? none() : (cur = none());
        }
      }

      // 2) shape
      const effectiveShape = step.shape ?? remapShapeFromParams(order, params);
      const okShape = validateLocalShape(local, effectiveShape, strict);
      if (!okShape.ok) { return strict ? none() : (cur = none()); }

      // 3) args
      const vals = argsFromLocal(local, order);
      if (!isFound(vals)) { return strict ? none() : (cur = none()); }
      let callArgs: any[] = foldEither(vals, () => [], r => r);

      // 4) self/method
      if (!isFound(cur) || !adapter.isInstance(foldEither(cur, () => null, r => r))) {
        return strict ? none() : (cur = none());
      }
      const self = foldEither(cur, () => null, r => r);
      const method = adapter.getMethod(self, step.op);
      if (!method) { return strict ? none() : (cur = none()); }

      // 5) lift
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

      if (!isFound(cur) || !adapter.isInstance(foldEither(cur, () => null, r => r))) {
        return strict ? none() : (cur = none());
      }
      if (!adapter.partial) { return strict ? none() : (cur = none()); }

      const vals = argsFromLocal(local, step.subsetOrder);
      if (!isFound(vals)) { return strict ? none() : (cur = none()); }

      const self = foldEither(cur, () => null, r => r);
      const argsArr = foldEither(vals, () => [], r => r);

      try {
        const closed = adapter.partial(self, step.op, step.subsetOrder, argsArr);
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
      if (strict && !isFound(cur)) return none();
      continue;
    }

    // ---------- Invoke (normal IR) ----------
    if (sAny.t === StepType.Invoke) {
      if (!isFound(cur) || !adapter.isInstance(foldEither(cur, () => null, r => r))) {
        cur = none(); continue;
      }
      const self = foldEither(cur, () => null, r => r);
      const method = adapter.getMethod(self, sAny.op);
      if (!method) { cur = none(); continue; }

      const argOpts = (sAny.args as ArgRef<D>[]).map(a => evalArg(adapter, a, cur as Optional<D>, scope));

      // strict sequencing: abort if any arg is none
      const argsArr: any[] = [];
      let bad = false;
      for (const o of argOpts) {
        if (!isFound(o)) { bad = true; break; }
        argsArr.push(foldEither(o, () => null, r => r));
      }
      if (bad) { if (strict) return none(); cur = none(); continue; }

      const meta = resolveMeta(self, sAny.op, method);
      const callArgs = (!meta?.liftScalar || !adapter.fromScalar)
        ? argsArr
        : argsArr.map((a, i) => {
            if (typeof a === "number") {
              if (meta.liftScalar === true) return adapter.fromScalar!(a);
              if (Array.isArray(meta.liftScalar) && meta.liftScalar[i]) return adapter.fromScalar!(a);
            }
            return a;
          });

      try { cur = some(method.apply(self, callArgs)); }
      catch { cur = none(); }
      continue;
    }
  }

  return cur;
}
