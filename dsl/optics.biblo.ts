import { OLens, oCompose, recordKey } from "./optics";

/** Build an optic for an object path: P('a','b','c') */
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

/** Common Biblo optics */
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

/** Peer helpers — return {peer, lens} pairs for building NDV from multiple peers. */
export const BibloPeers = {
  posX: (peer: string) => ({ peer, lens: oCompose(recordKey<any>("pos"), recordKey<any>("x")) }),
  posY: (peer: string) => ({ peer, lens: oCompose(recordKey<any>("pos"), recordKey<any>("y")) }),
  posZ: (peer: string) => ({ peer, lens: oCompose(recordKey<any>("pos"), recordKey<any>("z")) }),
  posXYZ: (peer: string) => ({
    x: { peer, lens: oCompose(recordKey<any>("pos"), recordKey<any>("x")) },
    y: { peer, lens: oCompose(recordKey<any>("pos"), recordKey<any>("y")) },
    z: { peer, lens: oCompose(recordKey<any>("pos"), recordKey<any>("z")) },
  }),
};
