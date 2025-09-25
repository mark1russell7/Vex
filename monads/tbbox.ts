import { Optional, some, none } from "../external/Funk/optional/optional";

/** TBBox<T>: simple Top/Bottom box as a class (adapter-friendly). */
export class TBBox<T> {
  private constructor(
    public readonly kind: "Top" | "Bottom",
    private readonly val?: T
  ) {}

  static top<T>(v: T): TBBox<T> { return new TBBox<T>("Top", v); }
  static bottom<T = never>(): TBBox<T> { return new TBBox<T>("Bottom"); }

  isTop(): boolean { return this.kind === "Top"; }
  isBottom(): boolean { return this.kind === "Bottom"; }

  /** map :: (T -> U) -> TBBox<U> */
  map<U>(f: (a:T)=>U): TBBox<U> {
    return this.isTop() ? TBBox.top(f(this.val as T)) : TBBox.bottom<U>();
  }

  /** chain :: (T -> TBBox<U>) -> TBBox<U> */
  chain<U>(f: (a:T)=>TBBox<U>): TBBox<U> {
    return this.isTop() ? f(this.val as T) : TBBox.bottom<U>();
  }

  /** getOptional :: Optional<T> */
  getOptional(): Optional<T> {
    return this.isTop() ? some(this.val as T) : none<T>();
  }

  valueOr<U>(fallback: U): T | U {
    return this.isTop() ? (this.val as T) : fallback;
  }
}
