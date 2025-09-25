import type { DomainAdapter } from "../domain/domain.adapter";
import { none, some, type Optional } from "../../external/Funk/optional/optional";
import type { Scope } from "./scope";

export function makeMapScope<Obj, D>(map: Record<string, Obj>, adapter: DomainAdapter<D>): Scope<D> {
  const keys = Object.keys(map);
  let idx = 0;

  const getCurrent = () => map[keys[idx]] as any;
  const getByKey = (k: string) => (map as any)[k];

  return {
    // domain-only reads
    getPropOpt: (prop) => {
      const v = getCurrent()?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    getPropOfOpt: (key, prop) => {
      const v = getByKey(key)?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },

    // NEW: raw reads (no domain guard)
    getRawPropOpt: (prop) => {
      const v = getCurrent()?.[prop];
      return v === undefined ? none<any>() : some(v);
    },
    getRawOfOpt: (key, prop) => {
      const v = getByKey(key)?.[prop];
      return v === undefined ? none<any>() : some(v);
    },

    setFocusByKey: (k) => { const i = keys.indexOf(k); if (i >= 0) idx = i; },
    setFocusByIndex: (i) => { if (i >= 0 && i < keys.length) idx = i; },
    setFocusToOther: () => { if (keys.length === 2) idx = idx ? 0 : 1; },
    currentKey: () => keys[idx],
    keys: () => [...keys]
  };
}
