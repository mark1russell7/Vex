import type { Optional as FamilyOptional } from "@mark1russell7/optional";
import type { VexError } from "./errors.ts";

/**
 * A value that is there, or not there. This is the public result of a Vex program. It is the Optional of the
 * family (`@mark1russell7/optional`), so render and Vex give and take the same values. The import is a type import
 * only: the build copies the type into the declarations, so the package has no runtime dependency.
 */
export type Optional<T> = FamilyOptional<T>;

/** A value, or the error that tells why there is no value. The interpreter uses this type. */
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: VexError };

const NONE: Optional<never> = Object.freeze({ tag: "none" });

/** This function makes an `Optional` that holds `value`. */
export const some = <T>(value: T): Optional<T> => ({ tag: "some", value });

/** This function gives the shared empty `Optional`. */
export const none = <T = never>(): Optional<T> => NONE;

/** This function makes a successful `Result`. */
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

/** This function makes a failed `Result`. */
export const fail = <T = never>(error: VexError): Result<T> => ({ ok: false, error });

/** This function tells if an `Optional` holds a value. */
export const isSome = <T>(o: Optional<T>): o is { readonly tag: "some"; readonly value: T } => o.tag === "some";

/** This function tells if an `Optional` is empty. */
export const isNone = <T>(o: Optional<T>): o is { readonly tag: "none" } => o.tag === "none";

/** This function changes a `Result` into an `Optional`. The error is lost. */
export const toOptional = <T>(r: Result<T>): Optional<T> => (r.ok ? some(r.value) : none());

/** This function gives the value of an `Optional`, or `fallback` if it is empty. */
export const getOr = <T, U>(o: Optional<T>, fallback: U): T | U => (o.tag === "some" ? o.value : fallback);

/** This function applies `f` to the value of a `Result`. An error stays the same. */
export const mapResult = <T, U>(r: Result<T>, f: (value: T) => U): Result<U> => (r.ok ? ok(f(r.value)) : r);

/** This function applies `f` to the value of a `Result`, and `f` gives a `Result`. An error stays the same. */
export const chainResult = <T, U>(r: Result<T>, f: (value: T) => Result<U>): Result<U> => (r.ok ? f(r.value) : r);
