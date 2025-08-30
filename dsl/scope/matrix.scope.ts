import { type DomainAdapter } from "../domain/domain.adapter";
import { none, Optional, some } from "../../external/Funk/optional/optional";
import { type MatrixLike } from "../lenses";
import { type Scope } from "./scope";
export function makeMatrixScope<Obj, D>(grid: MatrixLike<Obj>, adapter: DomainAdapter<D>) : Scope<D> {
  const H = grid.length, W = grid[0]?.length ?? 0;
  let i = 0, j = 0;
  const keys = Array.from({ length: H * W }, (_, k) => `${Math.floor(k / W)},${k % W}`);
  return {
    getPropOpt: (prop: string): Optional<D> => {
      const v: any = grid[i]?.[j]?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    getPropOfOpt: (key: string, prop: string): Optional<D> => {
      const [ii, jj] = key.split(",").map(Number);
      const v: any = grid[ii]?.[jj]?.[prop];
      return adapter.isInstance(v) ? some(v) : none<D>();
    },
    setFocusByKey: (k: string) => { [i, j] = k.split(",").map(Number) as any; },
    setFocusByIndex: (n: number) => { i = Math.floor(n / W); j = n % W; },
    setFocusToOther: () => { /* ambiguous on matrix → no-op */ },
    currentKey: () => `${i},${j}`,
    keys: () => keys,
  } as Scope<D>;
}