import { DomainAdapter } from "../domain/domain.adapter";
import { ValueKind } from "../value.enum";
import { Factory } from "../../math/factory/factory";

/** Adapter for Factory — single method 'invoke' with any args. */
export const FactoryAdapter: DomainAdapter<Factory> = {
  name: "Factory",
  isInstance: (v: unknown): v is Factory => v instanceof Factory,
  getMethod(self: Factory, name: string) { return (self as any)[name]; },
  methodReturns(name: string) {
    // result could be anything; keep it Unknown
    return ValueKind.Unknown;
  },
  methodParams(name: string) {
    if (name === "invoke") return [];  // caller must pass an explicit order if needed
    return [];
  },
};
