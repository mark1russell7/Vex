/**
 * The spaces of the Lab. Each space has records, domains, a builder root and preset programs. The preset code is
 * the text that the reader of the Lab reads, so each preset is a real Vex program.
 */
import { space, vex, type AnyDomain, type Space } from "@mark1russell7/vex";
import { BoolDomain, NumDomain } from "@mark1russell7/vex-domains";
import { DOMAINS, rootOf, spaceOf, type Boxes } from "./specimen.ts";

/** A preset program of a space. */
export interface Preset {
  readonly id: string;
  readonly title: string;
  readonly code: string;
}

/** The id of a space of the Lab. */
export type LabSpaceId = "boxes" | "life" | "org" | "rows";

/** A space of the Lab. `make` gives the space and the builder root, from the boxes of the specimen. */
export interface LabSpace {
  readonly id: LabSpaceId;
  readonly title: string;
  readonly summary: string;
  readonly domains: readonly AnyDomain[];
  readonly presets: readonly Preset[];
  readonly make: (boxes: Boxes) => { readonly space: Space; readonly root: unknown };
}

// ---------------------------------------------------------------- the Game of Life

/** The cells of the Life grid: a glider and a blinker. */
export const LIFE_ROWS: readonly (readonly { readonly alive: boolean }[])[] = (() => {
  const live = new Set(["0,1", "1,2", "2,0", "2,1", "2,2", "5,4", "5,5", "5,6"]);
  return Array.from({ length: 8 }, (_r, i) => Array.from({ length: 8 }, (_c, j) => ({ alive: live.has(`${i},${j}`) })));
})();
const lifeSpace = space.grid(LIFE_ROWS);
const lifeRoot = vex(NumDomain, BoolDomain).over(lifeSpace);

// ---------------------------------------------------------------- the organization

/** The people of the organization chart. */
export const PEOPLE = {
  ceo: { name: "Ada", role: "CEO", salary: 300 },
  cto: { name: "Bo", role: "CTO", salary: 200 },
  cfo: { name: "Ed", role: "CFO", salary: 190 },
  dev1: { name: "Cy", role: "Developer", salary: 100 },
  dev2: { name: "Di", role: "Developer", salary: 110 },
  ops: { name: "Fa", role: "Operations", salary: 120 },
  acct: { name: "Gu", role: "Accountant", salary: 90 },
} as const;

/** The parent of each person. */
export const PARENTS = { cto: "ceo", cfo: "ceo", dev1: "cto", dev2: "cto", ops: "cto", acct: "cfo" } as const;
const orgSpace = space.tree(PEOPLE, PARENTS);
const orgRoot = vex(NumDomain, BoolDomain).over(orgSpace);

// ---------------------------------------------------------------- the rows

/** The rows of the array space. */
export const ROWS: readonly { readonly v: number }[] = [4, 1, 3, 8, 2, 6].map((v) => ({ v }));
const rowsSpace = space.array(ROWS);
const rowsRoot = vex(NumDomain, BoolDomain).over(rowsSpace);

/** The spaces of the Lab. */
export const LAB_SPACES: readonly LabSpace[] = [
  {
    id: "boxes",
    title: "Boxes",
    summary: "Four boxes on graph paper: a record space. Drag a box to change the results.",
    domains: DOMAINS,
    make: (boxes) => ({ space: spaceOf(boxes), root: rootOf(boxes) }),
    presets: [
      {
        id: "nearest",
        title: "The distance to the nearest other box",
        code: `root.from("position")
  .others((e) => e._.distance("position"))
  .min()`,
      },
      {
        id: "overlap",
        title: "Does the box overlap another box?",
        code: `root.from("position")._.add("size")
  .others((e) =>
    e._.subtract("position")._.allPositive()._.and(
      e.from("position")._.add("size")._.subtract(e.origin().from("position"))._.allPositive()))
  .any()`,
      },
      {
        id: "corner",
        title: "The far corner of each box",
        code: `const corner = root.from("position")._.add("size");
corner`,
      },
      {
        id: "gap",
        title: "The offset to the box B",
        code: `root.from("position")._.subtract(root.of("B", "position"))`,
      },
      {
        id: "heavier",
        title: "The weight of the heavier others",
        code: `root.start(0)
  .others((e) => e.from("weight"), { where: (e) => e.from("weight")._.gt(e.origin().from("weight")) })
  .sum()`,
      },
    ],
  },
  {
    id: "life",
    title: "Life",
    summary: "An 8 by 8 grid with a glider and a blinker: a grid space. The axis neighbors reads the cells around a cell.",
    domains: [NumDomain, BoolDomain],
    make: () => ({ space: lifeSpace, root: lifeRoot }),
    presets: [
      {
        id: "next",
        title: "The next generation (the rule of Conway)",
        code: `const live = root.start(0)
  .neighbors(8, (n) => n, { where: (n) => n.from("alive") })
  .count();
live._.eq(3)._.or(root.from("alive")._.and(live._.eq(2)))`,
      },
      {
        id: "count",
        title: "The number of live neighbors",
        code: `root.start(0)
  .neighbors(8, (n) => n, { where: (n) => n.from("alive") })
  .count()`,
      },
      {
        id: "above",
        title: "The cell above (the top row gives #REF!)",
        code: `root.start(0).offset(-1, 0).from("alive")`,
      },
    ],
  },
  {
    id: "org",
    title: "Tree",
    summary: "An organization chart: a tree space. The axes children, ancestors, descendants and siblings follow it.",
    domains: [NumDomain, BoolDomain],
    make: () => ({ space: orgSpace, root: orgRoot }),
    presets: [
      {
        id: "team",
        title: "The cost of the team of each person",
        code: `root.from("salary")._.add(
  root.start(0).descendants((d) => d.from("salary")).sum())`,
      },
      {
        id: "depth",
        title: "The depth of each person",
        code: `root.start(0).ancestors((a) => a).count()`,
      },
      {
        id: "manager",
        title: "The name of the manager (a root gives #REF!)",
        code: `root.start(0).parent().from("name")`,
      },
      {
        id: "above-peers",
        title: "Is the salary above the mean of the siblings?",
        code: `root.from("salary")._.gt(
  root.start(0).siblings((s) => s.from("salary")).mean())`,
      },
    ],
  },
  {
    id: "rows",
    title: "Rows",
    summary: "Six rows of numbers: an array space. The move offset reads the row above, like R[-1]C in a spreadsheet.",
    domains: [NumDomain, BoolDomain],
    make: () => ({ space: rowsSpace, root: rowsRoot }),
    presets: [
      {
        id: "delta",
        title: "The change from the row above",
        code: `root.from("v").offset(-1)._.subtract("v")`,
      },
      {
        id: "share",
        title: "The share of the total",
        code: `root.from("v")._.divide(
  root.start(0).each((r) => r.from("v")).sum())`,
      },
      {
        id: "rank",
        title: "The number of larger rows (the rank)",
        code: `root.start(0)
  .others((o) => o, { where: (o) => o.from("v")._.gt(o.origin().from("v")) })
  .count()`,
      },
    ],
  },
];

/** This function gives the space of the Lab with the id `id`, or the first space. */
export const labSpace = (id: string | undefined): LabSpace => LAB_SPACES.find((s) => s.id === id) ?? (LAB_SPACES[0] as LabSpace);
