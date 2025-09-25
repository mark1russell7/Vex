import { OLens, oCompose, recordKey } from "./optics";

/**
 * A tiny "optics pack" for a Biblo-like object graph.
 * For now, Biblo is a plain object whose top-level keys are exact class names.
 * These helpers build Optional-first lenses for those paths.
 */

/** Build an optic for an object property path: P('a','b','c') */
export const P = (...keys: string[]): OLens<any, any> => {
  if (keys.length === 0) throw new Error("P() requires at least one key");
  let lens = recordKey<any>(keys[0]);
  for (let i = 1; i < keys.length; i++) lens = oCompose(lens, recordKey<any>(keys[i]));
  return lens;
};

/** Compose-friendly path builder */
export const Path = (...keys: string[]) => ({
  k: (k: string) => Path(...keys, k),
  lens: () => P(...keys),
});

/** Common, prebuilt optics for example Biblo entries */
export const BibloOptics = {
  vector: {
    entry: P("vector"),
    defaults: {
      factor: P("vector", "defaults", "factor"),
    },
    factory: P("vector", "factory"),
  },
  color: {
    entry: P("color"),
    palette: {
      red:   P("color", "palette", "red"),
      green: P("color", "palette", "green"),
      blue:  P("color", "palette", "blue"),
    }
  },
  angle: {
    entry: P("angle"),
    defaults: {
      radians: P("angle", "defaults", "radians"),
    }
  }
};
