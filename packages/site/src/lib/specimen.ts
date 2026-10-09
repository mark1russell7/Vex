/**
 * The specimen: four boxes on graph paper. Each widget on a page reads the same boxes, so a box that the
 * reader drags in one widget moves in all of them. The state lives in this module: each island of the page
 * imports the same module instance.
 */
import { space, vex, type Space } from "@mark1russell7/vex";
import { BoolDomain, Color, ColorDomain, NumDomain, Vec2, Vec2Domain } from "@mark1russell7/vex-domains";
import { useSyncExternalStore } from "react";

/** One box of the specimen. */
export interface Box {
  readonly position: Vec2;
  readonly size: Vec2;
  readonly color: Color;
  readonly weight: number;
  readonly name: string;
}

/** The keys of the specimen. */
export type BoxKey = "A" | "B" | "C" | "D";

/** The boxes, by key. */
export type Boxes = Readonly<Record<BoxKey, Box>>;

/** The start state of the specimen. */
export const INITIAL_BOXES: Boxes = {
  A: { position: new Vec2(2, 2), size: new Vec2(5, 4), color: new Color(35, 70, 196), weight: 2, name: "anchor" },
  B: { position: new Vec2(6, 5), size: new Vec2(4, 4), color: new Color(194, 48, 31), weight: 3, name: "bolt" },
  C: { position: new Vec2(13, 3), size: new Vec2(3, 6), color: new Color(12, 163, 12), weight: 5, name: "crate" },
  D: { position: new Vec2(4, 11), size: new Vec2(7, 2), color: new Color(250, 178, 25), weight: 1, name: "deck" },
};

/** The domains of the specimen programs. */
export const DOMAINS = [Vec2Domain, NumDomain, BoolDomain, ColorDomain] as const;

let boxes: Boxes = INITIAL_BOXES;
const listeners = new Set<() => void>();

/** This function gives the current boxes. */
export const getBoxes = (): Boxes => boxes;

/** This function replaces the boxes and tells each widget. */
export function setBoxes(next: Boxes): void {
  boxes = next;
  for (const l of listeners) l();
}

/** This function moves one box to a new position. */
export function moveBox(k: BoxKey, position: Vec2): void {
  setBoxes({ ...boxes, [k]: { ...boxes[k], position } });
}

/** This function puts the boxes back to the start state. */
export const resetBoxes = (): void => setBoxes(INITIAL_BOXES);

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** This React hook gives the current boxes and renders again when they change. */
export const useBoxes = (): Boxes => useSyncExternalStore(subscribe, getBoxes, () => INITIAL_BOXES);

/** This function gives the space of the boxes. */
export const spaceOf = (b: Boxes): Space<BoxKey, Box> => space.record(b);

/** This function gives the builder root over the boxes. */
export const rootOf = (b: Boxes) => vex(...DOMAINS).over(spaceOf(b));

/** The type of the builder root of the specimen. */
export type SpecimenRoot = ReturnType<typeof rootOf>;
