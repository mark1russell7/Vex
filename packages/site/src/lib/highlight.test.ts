import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { highlight } from "./highlight.ts";
import { LAB_SPACES } from "./lab-spaces.ts";

const kinds = (src: string): string => highlight(src).map((p) => `${p.kind}:${p.text.trim()}`).filter((s) => !s.endsWith(":")).join(" ");

describe("the highlighter of the Lab", () => {
  it("gives a kind to each part of a chain", () => {
    expect(kinds(`const c = root.from("size")._.halve(); // half`)).toBe(
      'keyword:const plain:c punct:= root:root punct:. member:from punct:( string:"size" punct:). plain:_ punct:. op:halve punct:(); comment:// half',
    );
    expect(kinds(`(e) => e._.add(-1.5)`)).toBe("punct:( plain:e punct:) keyword:=> plain:e punct:. plain:_ punct:. op:add punct:(- number:1.5 punct:)");
  });

  it("does not throw, and keeps each character, for each text", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (src) => {
        expect(highlight(src).map((p) => p.text).join("")).toBe(src);
      }),
    );
    expect(highlight(`root.from("open`).at(-1)).toEqual({ kind: "string", text: '"open' });
  });

  it("keeps each preset of the Lab", () => {
    for (const s of LAB_SPACES) for (const p of s.presets) expect(highlight(p.code).map((x) => x.text).join("")).toBe(p.code);
  });
});
