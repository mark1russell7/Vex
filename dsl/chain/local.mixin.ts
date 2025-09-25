import { LocalMap } from "../params/local.map";
import { LocalMapFor, asLocalFor } from "../params/local.typed";
import { Optional, some, none } from "../../external/Funk/optional/optional";
import { DomainExpr } from "../domain/domain.expr";
import { ValueKind } from "../value.enum";
import type { OLens } from "../optics";

type LocalSetStep<D> =
  | { t: "local:set"; name: string; src: { kind: "prop"; prop: string } }
  | { t: "local:set"; name: string; src: { kind: "of"; key: string; prop: string } }
  | { t: "local:set"; name: string; src: { kind: "expr"; expr: DomainExpr<D> } }
  | { t: "local:setLens"; name: string; src: { kind: "lens"; focusLens: OLens<any, any> } }
  | { t: "local:setOptic"; name: string; optic: OLens<any, any> }
  | { t: "local:setPeerOptic"; name: string; key: string; optic: OLens<any, any> };

type LocalApplyStep = { t: "local:apply"; op: string; order?: string[]; shape?: Record<string, ValueKind> };
type LocalPartialStep = { t: "local:partial"; op: string; subsetOrder: string[]; storeAs: string };
type RawForKind<D, K extends ValueKind> =
  K extends ValueKind.Domain  ? D :
  K extends ValueKind.Scalar  ? number :
  K extends ValueKind.Boolean ? boolean :
  never;
// Tell TS that if S[K] is Domain, localSetProp(K, ...) is allowed
type DomainKeys<S> = { [K in keyof S]: S[K] extends ValueKind.Domain ? K : never }[keyof S];

export function withLocal<
  Obj,
  D,
  TBase extends new (...a: any[]) => any,
  S extends Record<string, ValueKind> = Record<string, ValueKind>,
>(Base: TBase) {
  return class LocalChain extends (Base as any) {
    public _local: LocalMap<D> = new LocalMap<D>();
    localFor<S extends Record<string, ValueKind>>() { return asLocalFor<D, S>(this._local); }
    adoptLocal<S extends Record<string, ValueKind>>(m: LocalMapFor<D, S>): this { this._local = m.erase(); return this; }
    getLocal(): LocalMap<D> { return this._local; }

    // typed overload: only keys present in S are accepted, with correct value type
    localSetConst<K extends keyof S & string>(
      name: K,
      v: RawForKind<D, S[K]>
    ): this;

    // impl
    localSetConst(name: any, v: any): this {
      (this as any)._steps.push({ t: "local:setConst", name, value: v });
      return this;
    }
    localSetProp<K extends DomainKeys<S> & string>(name: K, prop: string): this;
    localSetProp(name: string, prop: string): this; // fallback
    localSetProp(name: any, prop: any): this {
      (this as any)._steps.push({ t: "local:set", name, src: { kind: "prop", prop } });
      return this;
    }
    localSetOf(name: string, key: string, prop: string): this {
      (this as any)._steps.push({ t: "local:set", name, src: { kind: "of", key, prop } } as LocalSetStep<D>);
      return this;
    }
    localSetExpr(name: string, expr: DomainExpr<D>): this {
      (this as any)._steps.push({ t: "local:set", name, src: { kind: "expr", expr } } as LocalSetStep<D>);
      return this;
    }
    localSetLens(name: string, lens: OLens<any, any>): this {
      (this as any)._steps.push({ t: "local:setLens", name, src: { kind: "lens", focusLens: lens } } as LocalSetStep<D>);
      return this;
    }
    localSetOptic(name: string, optic: OLens<any, any>): this {
      (this as any)._steps.push({ t: "local:setOptic", name, optic });
      return this;
    }
    localSetPeerOptic(name: string, key: string, optic: OLens<any, any>): this {
      (this as any)._steps.push({ t: "local:setPeerOptic", name, key, optic });
      return this;
    }

    localRename(from: string, to: string): this { this._local = this._local.rename(from, to); return this; }
    localRemove(name: string): this { this._local = this._local.remove(name); return this; }
    localProject(...names: string[]): this { this._local = this._local.project(names); return this; }
    localMerge(other: LocalMap<D>): this { this._local = this._local.merge(other); return this; }
    localClear(): this { this._local = this._local.clear(); return this; }

    localRequire(shape: Record<string, ValueKind>): Optional<this> {
      const ok = this._local.require(shape);
      return ok.tag === 'Right' ? some(this) : none<this>();
    }

    applyUsing(op: string, order?: string[], shape?: Record<string, ValueKind>): this {
      (this as any)._steps.push({ t: "local:apply", op, order, shape } as LocalApplyStep);
      return this;
    }
    applyPartial(op: string, subsetOrder: string[], storeAs: string): this {
      (this as any)._steps.push({ t: "local:partial", op, subsetOrder, storeAs } as LocalPartialStep);
      return this;
    }
  };
}
