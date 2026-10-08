/**
 * The programs of the site. Each program has the code that a reader writes and a function that builds its
 * expression over the boxes. The error demos use the IR directly: the typed builder does not let a reader
 * write them.
 */
import { app, key, lit, ref, type Expr, type FreeFn } from "@vex/core";
import type { SpecimenRoot } from "./specimen.ts";

/** A program of the site. */
export interface SiteProgram {
  readonly id: string;
  readonly title: string;
  /** The code that the reader writes, as text. */
  readonly code: string;
  /** This function gives the expression of the program over the root of the boxes. */
  readonly build: (root: SpecimenRoot) => Expr;
  /** The free functions that the program needs. */
  readonly fns?: Readonly<Record<string, FreeFn>>;
}

/** The programs with the builder. */
export const PROGRAMS: readonly SiteProgram[] = [
  {
    id: "far-corner",
    title: "The far corner of each box",
    code: `root.from("position")._.add("size")`,
    build: (root) => root.from("position")._.add("size").program,
  },
  {
    id: "centre",
    title: "The centre of each box",
    code: `root.from("size")._.halve()._.add("position")`,
    build: (root) => root.from("size")._.halve()._.add("position").program,
  },
  {
    id: "gap-to-b",
    title: "The gap from the far corner to the box B",
    code: `root.from("position")._.add("size")._.subtract(root.of("B", "position"))`,
    build: (root) => root.from("position")._.add("size")._.subtract(root.of("B", "position")).program,
  },
  {
    id: "nearest",
    title: "The distance to the nearest other box",
    code: `root.from("position")\n  .others((e) => e._.subtract("position")._.length())\n  .min()`,
    build: (root) => root.from("position").others((e) => e._.subtract("position")._.length()).min().program,
  },
  {
    id: "offsets",
    title: "The sum of the offsets to the others",
    code: `root.from("position")\n  .others((e) => e._.subtract("position"))\n  .reduce("add")`,
    build: (root) => root.from("position").others((e) => e._.subtract("position")).reduce("add").program,
  },
  {
    id: "overlaps",
    title: "Does the box overlap another box?",
    code: `root.from("position")._.add("size")\n  .others((e) =>\n    e._.subtract("position")._.allPositive()._.and(\n      e.from("position")._.add("size")._.subtract(e.origin().from("position"))._.allPositive()))\n  .any()`,
    build: (root) =>
      root.from("position")
        ._.add("size")
        .others((e) => e._.subtract("position")._.allPositive()._.and(e.from("position")._.add("size")._.subtract(e.origin().from("position"))._.allPositive()))
        .any().program,
  },
  {
    id: "heaviest-other",
    title: "The weight of the heaviest other box",
    code: `root.from("weight").others((e) => e.from("weight")).max()`,
    build: (root) => root.from("weight").others((e) => e.from("weight")).max().program,
  },
];

/** The error demos: one program for each error code. */
export const ERROR_PROGRAMS: Readonly<Record<string, SiteProgram & { readonly fix: string }>> = {
  "REF": {
    id: "ref",
    title: "A reference to a key that the space does not have",
    code: `ref("position", [key("Z")])`,
    fix: "Use a key of the space. The typed builder accepts only the keys of the space, so this program is not possible there.",
    build: () => ref("position", [key("Z")]),
  },
  "NA": {
    id: "na",
    title: "A field that the record does not have",
    code: `app("add", ref("position"), ref("mass"))`,
    fix: "Read a field that each record has, or give a fallback with ifError.",
    build: () => app("add", ref("position"), ref("mass")),
  },
  "VALUE": {
    id: "value",
    title: "An argument of the wrong kind",
    code: `app("add", ref("position"), lit(true))`,
    fix: "Give a vector or a number. The op add declares a domain parameter, so the interpreter checks the argument.",
    build: () => app("add", ref("position"), lit(true)),
  },
  "NAME": {
    id: "name",
    title: "An op that the domain does not declare",
    code: `app("explode", ref("position"))`,
    fix: "Use an op of the domain. The builder lists the ops of the domain under ._, so this program is not possible there.",
    build: () => app("explode", ref("position")),
  },
  "NUM": {
    id: "num",
    title: "A result that is not a finite number",
    code: `app("divide", ref("position"), lit(0))`,
    fix: "Do not divide by a vector with a zero component. The number 0 lifts to the vector (0, 0).",
    build: () => app("divide", ref("position"), lit(0)),
  },
  "CALC": {
    id: "calc",
    title: "An op that throws an exception",
    code: `app("parseWeight", ref("name"))`,
    fix: "Find why the op throws. The error keeps the thrown value.",
    build: () => app("parseWeight", ref("name")),
    fns: {
      parseWeight: (name: unknown): number => {
        throw new Error(`no weight in the name "${String(name)}"`);
      },
    },
  },
  "ARGS": {
    id: "args",
    title: "Two arguments that both fail",
    code: `app("add", ref("mass"), ref("speed"))`,
    fix: "Correct each argument. The error lists each cause.",
    build: () => app("add", ref("mass"), ref("speed")),
  },
};

/** This function gives a program by its id. */
export const programById = (id: string): SiteProgram | undefined => PROGRAMS.find((p) => p.id === id) ?? Object.values(ERROR_PROGRAMS).find((p) => p.id === id);

/** A literal helper for widget code that makes IR by hand. */
export { lit };
