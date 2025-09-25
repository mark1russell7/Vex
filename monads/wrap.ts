import type { Empty } from "../algebra/empty";

/** Wrap<T> — a tiny applicative with Empty semantics pluggable per T. */
export class Wrap<T> {
  constructor(public readonly value: T, private readonly E?: Empty<T>) {}

  static of<T>(x: T, E?: Empty<T>) { return new Wrap(x, E); }

  map<B>(f: (a:T)=>B, EB?: Empty<B>): Wrap<B> {
    return new Wrap(f(this.value), EB);
  }

  ap<B>(wf: Wrap<(a:T)=>B>, EB?: Empty<B>): Wrap<B> {
    return new Wrap(wf.value(this.value), EB);
  }

  /** reset to empty if provided */
  empty(): Wrap<T> {
    return this.E ? new Wrap(this.E.empty(), this.E) : this;
  }

  isEmpty(): boolean {
    return this.E ? this.E.isEmpty(this.value) : false;
  }
}
