// optional/utils.ts
import { Optional, none, some, isFound } from "./external/Funk/optional/optional";
import { fold as foldEither } from "./external/Funk/optional/either";

/** Functor map over Optional */
export const mapOpt = <A, B>(oa: Optional<A>, f: (a: A) => B): Optional<B> =>
  foldEither(oa, () => none<B>(), (a) => some(f(a)));

/** Monad chain over Optional */
export const chainOpt = <A, B>(oa: Optional<A>, f: (a: A) => Optional<B>): Optional<B> =>
  foldEither(oa, () => none<B>(), (a) => f(a));

/** Applicative ap over Optional */
export const apOpt = <A, B>(of: Optional<(a: A) => B>, oa: Optional<A>): Optional<B> =>
  foldEither(of,
    () => none<B>(),
    (fn) => foldEither(oa, () => none<B>(), (a) => some(fn(a)))
  );

/** Sequence array of Optional into Optional array (strict: fails if any is none) */
export const sequenceArrayOpt = <A>(xs: Optional<A>[]): Optional<A[]> => {
  const out: A[] = [];
  for (const o of xs) {
    const ok = foldEither(o, () => false, (a) => (out.push(a), true));
    if (!ok) return none<A[]>();
  }
  return some(out);
};

/** Reduce Optionals with a Monoid, ignoring none by default */
export function reduceWithMonoidOpt<T>(
  xs: Optional<T>[],
  M: { empty: T; concat: (a: T, b: T) => T }
): Optional<T> {
  let acc: T | undefined = undefined;
  for (const o of xs) {
    foldEither(
      o,
      () => { /* ignore none */ },
      (a) => { acc = acc === undefined ? a : M.concat(acc, a); }
    );
  }
  return acc === undefined ? none<T>() : some(acc);
}
