import { type Optional, none, some, isFound } from "../../external/Funk/optional/optional";
import { fold as foldEither } from "../../external/Funk/optional/either";
import { ValueKind } from "../value.enum";

export type LocalEntry<D> =
  | { tag: "domain";  value: D }
  | { tag: "scalar";  value: number }
  | { tag: "boolean"; value: boolean }
  | { tag: "any";     value: any };  
export class LocalMap<D> {
  private readonly m: ReadonlyMap<string, LocalEntry<D>>;
  constructor(m: ReadonlyMap<string, LocalEntry<D>> = new Map()) { this.m = m; }

  set(name: string, entry: LocalEntry<D>): LocalMap<D> {
    const n = new Map(this.m); n.set(name, entry); return new LocalMap(n);
  }
  remove(name: string): LocalMap<D> { const n = new Map(this.m); n.delete(name); return new LocalMap(n); }
  rename(from: string, to: string): LocalMap<D> {
    const n = new Map(this.m);
    if (n.has(from)) { const v = n.get(from)!; n.delete(from); n.set(to, v); }
    return new LocalMap(n);
  }
  merge(other: LocalMap<D>): LocalMap<D> {
    const n = new Map(this.m);
    for (const [k, v] of other.m) n.set(k, v);
    return new LocalMap(n);
  }
  project(names: string[]): LocalMap<D> {
    const n = new Map<string, LocalEntry<D>>();
    for (const k of names) if (this.m.has(k)) n.set(k, this.m.get(k)!);
    return new LocalMap(n);
  }
  clear(): LocalMap<D> { return new LocalMap(); }

  get(name: string): Optional<LocalEntry<D>> {
    return this.m.has(name) ? some(this.m.get(name)!) : none();
  }

  /** Only enforce kinds when a shape is provided. When absent, 'any' is allowed. */
  require(shape: Record<string, ValueKind>): Optional<LocalMap<D>> {
    for (const [k, kind] of Object.entries(shape)) {
      const e = this.get(k);
      if (!isFound(e)) return none<LocalMap<D>>();
      const ok = foldEither(e, () => false, (v) => {
        if (kind === ValueKind.Domain)  return v.tag === "domain";
        if (kind === ValueKind.Scalar)  return v.tag === "scalar";
        if (kind === ValueKind.Boolean) return v.tag === "boolean";
        // Unknown → accept anything (domain/number/boolean/any)
        return true;
      });
      if (!ok) return none<LocalMap<D>>();
    }
    return some(this);
  }

  valuesIn(order: string[]): Optional<any[]> {
    const out: any[] = [];
    for (const k of order) {
      const e = this.get(k);
      if (!isFound(e)) return none<any[]>();
      out.push(foldEither(e, () => undefined, r => r.value));
    }
    return some(out);
  }
}
