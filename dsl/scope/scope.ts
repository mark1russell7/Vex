import { Optional } from "../../external/Funk/optional/optional";

/* ---------------- Scope abstraction ---------------- */
export interface Scope<D> {
  getPropOpt(prop: string): Optional<D>;
  getPropOfOpt(key: string, prop: string): Optional<D>;
  setFocusByKey(key: string): void;
  setFocusByIndex(index: number): void;
  setFocusToOther(): void;
  currentKey(): string;
  keys(): string[];
}
