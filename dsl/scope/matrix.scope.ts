import type { DomainAdapter } from "../domain/domain.adapter";
import { none, some, type Optional } from "../../external/Funk/optional/optional";
import type { Scope } from "./scope";

export function makeMatrixScope<Obj, D>(grid: Obj[][], adapter: DomainAdapter<D>) : Scope<D> {
  const H = grid.length, W = grid[0]?.length ?? 0;
  let i = 0, j = 0;
  const keys = Array.from({ length: H * W }, (_, k) => `${Math.floor(k / W)},${k % W}`);

  const getAt = (ii: number, jj: number) => (grid as any)[ii]?.[jj];

  return {
    // domain-only
    getPropOpt: (prop: string): Optional<D> => {
      const v: any = getAt(i, j)?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    getPropOfOpt: (key: string, prop: string): Optional<D> => {
      const [ii, jj] = key.split(",").map(Number);
      const v: any = getAt(ii, jj)?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },

    // NEW raw
    getRawPropOpt: (prop: string): Optional<any> => {
      const v: any = getAt(i, j)?.[prop];
      return v === undefined ? none<any>() : some(v);
    },
    getRawOfOpt: (key: string, prop: string): Optional<any> => {
      const [ii, jj] = key.split(",").map(Number);
      const v: any = getAt(ii, jj)?.[prop];
      return v === undefined ? none<any>() : some(v);
    },

    setFocusByKey: (k: string) => { [i, j] = k.split(",").map(Number) as any; },
    setFocusByIndex: (n: number) => { i = Math.floor(n / W); j = n % W; },
    setFocusToOther: () => { /* ambiguous on matrix */ },
    currentKey: () => `${i},${j}`,
    keys: () => keys,
  } as Scope<D>;
}
