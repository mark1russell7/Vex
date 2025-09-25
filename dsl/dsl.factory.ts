import { BaseChain } from "./chain/base.chain";
import { type DomainAdapter } from "./domain/domain.adapter";
import { domainExpr } from "./domain/domain.expr";
import { type ArrayLike, type MapLike, type MatrixLike } from "./lenses";
import { makeArrayScope } from "./scope/array.scope";
import { makeMapScope } from "./scope/map.scope";
import { makeMatrixScope } from "./scope/matrix.scope";

export function createDSL<D>(adapter: DomainAdapter<D>) {
  return {
    /** Build expressions for this domain. */
    expr: () => domainExpr<D>(),
    /** Map chain with schema typing (provide the object type for strong prop autocompletion). */
    mapChain<Obj extends Record<string, any>>(map: MapLike<Obj>) {
      return new BaseChain<Obj, D>(adapter, makeMapScope<Obj, D>(map, adapter));
    },
    arrayChain<Obj extends Record<string, any>>(arr: ArrayLike<Obj>) {
      return new BaseChain<Obj, D>(adapter, makeArrayScope<Obj, D>(arr, adapter));
    },
    matrixChain<Obj extends Record<string, any>>(grid: MatrixLike<Obj>) {
      return new BaseChain<Obj, D>(adapter, makeMatrixScope<Obj, D>(grid, adapter));
    }
  };
}