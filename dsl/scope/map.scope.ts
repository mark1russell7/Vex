import { type DomainAdapter } from "../domain/domain.adapter";
import { none, some } from "../../external/Funk/optional/optional";
import { type Scope } from "./scope";

export function makeMapScope<Obj, D>(map: Record<string, Obj>, adapter: DomainAdapter<D>): Scope<D> {
  const keys = Object.keys(map);
  let idx = 0;
  return {
    getPropOpt: (prop) => {
      const item: any = map[keys[idx]];
      const v = item?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    getPropOfOpt: (key, prop) => {
      const item: any = map[key];
      const v = item?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    setFocusByKey: (k) => { const i = keys.indexOf(k); idx = i >= 0 ? i : idx; },
    setFocusByIndex: (i) => { if (i >= 0 && i < keys.length) idx = i; },
    setFocusToOther: () => { if (keys.length === 2) idx = idx ? 0 : 1; },
    currentKey: () => keys[idx],
    keys: () => [...keys]
  };
}