/**
 * The prelude of the doc tests. A code block of the docs with the meta word `doctest` can use each name of this
 * module without an import. The names are the API of the three packages and the specimen boxes `A`, `B`, `C`
 * and `D`. The record `boxes` holds the boxes, and `root` is the builder over them.
 */
import { INITIAL_BOXES, rootOf } from "./specimen.ts";

export * from "@mark1russell7/vex";
export * from "@mark1russell7/vex-domains";
export { checkLaws, assertLaws, referenceEvaluate } from "@mark1russell7/vex-testkit";

export const boxes = INITIAL_BOXES;
export const { A, B, C, D } = INITIAL_BOXES;
export const root = rootOf(INITIAL_BOXES);
