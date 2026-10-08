import type { DomainAdapter } from "../domain/domain.adapter.ts";
import { makeMapScope } from "./map.scope.ts";
import type { Scope } from "./scope.ts";

export function makeArrayScope<Obj, D>(arr: Obj[], adapter: DomainAdapter<D>) : Scope<D> {
  const map: Record<string, Obj> = Object.fromEntries(arr.map((v, i) => [String(i), v]));
  return makeMapScope(map, adapter);
}
