export type Either<L,R>
  = { tag : 'Left' ; left  : L }
  | { tag : 'Right'; right : R };

export const left  = <L, R = never>(l : L) : Either<L,R> => ({ tag : 'Left' , left  : l });
export const right = <R, L = never>(r : R) : Either<L,R> => ({ tag : 'Right', right : r });

export const isLeft  = <L, R>(e : Either<L, R>) : e is { tag : 'Left' ; left  : L } => e.tag === 'Left';
export const isRight = <L, R>(e : Either<L, R>) : e is { tag : 'Right'; right : R } => e.tag === 'Right';



export const getOrElse = <L, R>(e : Either<L, R>, defaultVal : R) : R => isRight(e) ? e.right : defaultVal;
export const orElse = <L, R>(e : Either<L, R>, f : (l : L) => R) : R => isRight(e) ? e.right : f(e.left);
export const orElseThrow = <L, R, E extends Error>(e : Either<L, R>, errorFn : (l : L) => E) : R => isRight(e) ? e.right : (() => { throw errorFn(e.left); })();

export const fold = <L, R, T>(
  e : Either<L, R>,
  onLeft  : (l : L) => T,
  onRight : (r : R) => T
) : T => 
  e.tag === 'Right'
    ? onRight(e.right)
    : onLeft (e.left);

export const map = <L, R, LL, RR>(
  e : Either<L, R>,
  fnLeft : (l : L) => LL, 
  fnRight : (r : R) => RR
) : Either<LL, RR> =>
  e.tag === 'Right'
    ? right(fnRight(e.right))
    : left(fnLeft(e.left));

export const mapLeft = <L, R, LL>(
  e : Either<L, R>,
  f : (l : L) => LL
) : Either<LL, R> => 
  e.tag === 'Left'
    ? left(f(e.left))
    : e;

export const mapRight = <L, R, RR>(
  e : Either<L, R>,
  f : (r : R) => RR
) : Either<L, RR> => 
  e.tag === 'Right'
    ? right(f(e.right))
    : e;

export const chain = <L, R, RR>(
  e : Either<L, R>,
  f : (r : R) => Either<L, RR>
) : Either<L, RR> => 
  e.tag === 'Right'
    ? f(e.right)
    : e;

export function tapLeft<L, R>(e : Either<L, R>, fn : (l : L) => void) : Either<L, R> {
  if (isLeft(e)) {
    fn(e.left);
  }
  return e;
}
export function tapRight<L, R>(e : Either<L, R>, fn : (r : R) => void) : Either<L, R> {
  if (isRight(e)) {
    fn(e.right);
  }
  return e;
}
export function tap<L, R>(e : Either<L, R>, fnLeft : (l : L) => void, fnRight : (r : R) => void) : Either<L, R> {
  if (isLeft(e)) {
    fnLeft(e.left);
  } else {
    fnRight(e.right);
  }
  return e;
}
