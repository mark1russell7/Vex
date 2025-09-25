import type { DomainAdapter } from "../domain/domain.adapter";
import { makeMapScope } from "./map.scope";
import type { Scope } from "./scope";

export function makeArrayScope<Obj, D>(arr: Obj[], adapter: DomainAdapter<D>) : Scope<D> {
  const map: Record<string, Obj> = Object.fromEntries(arr.map((v, i) => [String(i), v]));
  return makeMapScope(map, adapter);
}
