import { type Either, isRight, left, right } from "./either.ts";

export const NotFound: unique symbol = Symbol('NotFound');
export type TNotFound = typeof NotFound;

export type Optional<T> = Either<TNotFound, T>;

export const none       = <T>()      : Optional<T> => left<TNotFound>(NotFound);
export const some       = <T>(v : T) : Optional<T> => right<T>(v);

export const isFound    = <T>(o : Optional<T>)    : o is Either<never, T> => isRight(o);
export const isDefined  = <T>(o : T | undefined)  : o is T                => o !== undefined;

export const nullable   = <T>(o : T | undefined) : Optional<T> => isDefined(o) 
                                                                    ? some(o) 
                                                                    : none<T>();