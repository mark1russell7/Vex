import { Optional, some, none } from "../../external/Funk/optional/optional";
import { ValueKind } from "../value.enum";
import { LocalMap, LocalEntry } from "./local.map";
import { ParamShape } from "./param.shape";

export type EntryForKind<D, K extends ValueKind> =
  K extends ValueKind.Domain  ? { tag: "domain";  value: D }
: K extends ValueKind.Scalar  ? { tag: "scalar";  value: number }
: K extends ValueKind.Boolean ? { tag: "boolean"; value: boolean }
: never;

/** A compile-time constrained LocalMap keyed by a ParamShape S. */
export class LocalMapFor<D, S extends ParamShape> {
  constructor(private readonly inner: LocalMap<D> = new LocalMap<D>()) {}

  set<K extends keyof S & string>(name: K, entry: EntryForKind<D, S[K]>): LocalMapFor<D, S> {
    return new LocalMapFor<D, S>(this.inner.set(name, entry as LocalEntry<D>));
  }
  get<K extends keyof S & string>(name: K): Optional<EntryForKind<D, S[K]>> {
    const v = this.inner.get(name);
    return v as any;
  }
  project<K extends (keyof S & string)[]>(...names: K): LocalMapFor<D, Pick<S, K[number]>> {
    return new LocalMapFor<D, any>(this.inner.project(names as any));
  }
  erase(): LocalMap<D> { return this.inner; }
  require(shape: S): Optional<LocalMapFor<D, S>> {
    const ok = this.inner.require(shape);
    return ok.tag === "Right" ? some(this) : none();
  }
}

export const asLocalFor = <D, S extends ParamShape>(m: LocalMap<D>): LocalMapFor<D, S> =>
  new LocalMapFor<D, S>(m);
