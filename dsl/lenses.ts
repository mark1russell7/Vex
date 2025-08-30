/* ---------------- Lenses / Schema ---------------- */
/** Keys of T whose type extends D. */
export type KeysOfType<T, D> = { [K in keyof T]-?: T[K] extends D ? K : never }[keyof T];

export type MapLike<T> = Record<string, T>;
export type ArrayLike<T> = T[];
export type MatrixLike<T> = T[][];