import { type Optional, none, some } from "../../external/Funk/optional/optional";
import { ValueKind } from "../value.enum";

export type LocalEntry<D> =
  | { tag: "domain"; value: D }
  | { tag: "scalar"; value: number }
  | { tag: "boolean"; value: boolean };

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
    if (!this.m.has(name)) return none();
    return some(this.m.get(name)!);
  }

  require(shape: Record<string, ValueKind>): Optional<LocalMap<D>> {
    for (const [k, kind] of Object.entries(shape)) {
      const e = this.get(k);
      if (e.tag === 'Left') return none<LocalMap<D>>();
      const v = (e as any).right as LocalEntry<D>;
      if (kind === ValueKind.Domain  && v.tag !== "domain")  return none();
      if (kind === ValueKind.Scalar  && v.tag !== "scalar")  return none();
      if (kind === ValueKind.Boolean && v.tag !== "boolean") return none();
    }
    return some(this);
  }

  valuesIn(order: string[]): Optional<any[]> {
    const out: any[] = [];
    for (const k of order) {
      const e = this.get(k);
      if (e.tag === 'Left') return none<any[]>();
      out.push((e as any).right.value);
    }
    return some(out);
  }
}
