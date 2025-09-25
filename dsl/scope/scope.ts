import type { Optional } from "../../external/Funk/optional/optional";

/* ---------------- Scope abstraction ---------------- */
export interface Scope<D> {
  // Domain-typed getters (enforce adapter.isInstance)
  getPropOpt(prop: string): Optional<D>;
  getPropOfOpt(key: string, prop: string): Optional<D>;

  // NEW: Raw getters (no domain check) — enable Biblo/aux data access
  getRawPropOpt(prop: string): Optional<any>;
  getRawOfOpt(key: string, prop: string): Optional<any>;

  setFocusByKey(key: string): void;
  setFocusByIndex(index: number): void;
  setFocusToOther(): void;
  currentKey(): string;
  keys(): string[];
}
