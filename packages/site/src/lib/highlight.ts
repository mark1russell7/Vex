/**
 * A small highlighter for Vex chains. It splits the text into pieces, and each piece has a kind for its colour. The
 * highlighter does not throw, and the pieces together are the full text. Thus the Lab can show half-written code.
 */

/** The kind of a piece of code. */
export type PieceKind = "plain" | "keyword" | "string" | "number" | "comment" | "root" | "op" | "member" | "punct";

/** A piece of code with a kind. */
export interface Piece {
  readonly kind: PieceKind;
  readonly text: string;
}

const KEYWORDS = new Set(["const", "let", "true", "false", "null", "undefined"]);

/** This function splits `src` into pieces. The text of the pieces, in sequence, is `src`. */
export function highlight(src: string): readonly Piece[] {
  const out: Piece[] = [];
  const push = (kind: PieceKind, text: string): void => {
    const last = out.at(-1);
    if (last !== undefined && last.kind === kind) out[out.length - 1] = { kind, text: last.text + text };
    else out.push({ kind, text });
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    const comment = /^\/\/[^\n]*/.exec(rest);
    if (comment !== null) {
      push("comment", comment[0]);
      i += comment[0].length;
      continue;
    }
    const quote = rest[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      let j = 1;
      while (j < rest.length && rest[j] !== quote && rest[j] !== "\n") j += rest[j] === "\\" ? 2 : 1;
      const text = rest.slice(0, Math.min(rest.length, j + 1));
      push("string", text);
      i += text.length;
      continue;
    }
    const num = /^\d[\d._eE]*/.exec(rest);
    if (num !== null) {
      push("number", num[0]);
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (id !== null) {
      const name = id[0];
      const before = src.slice(Math.max(0, i - 3), i);
      const kind: PieceKind = KEYWORDS.has(name)
        ? "keyword"
        : name === "root"
          ? "root"
          : before === "._."
            ? "op"
            : before.endsWith(".") && name !== "_"
              ? "member"
              : "plain";
      push(kind, name);
      i += name.length;
      continue;
    }
    if (rest.startsWith("=>")) {
      push("keyword", "=>");
      i += 2;
      continue;
    }
    const space = /^\s+/.exec(rest);
    if (space !== null) {
      push("plain", space[0]);
      i += space[0].length;
      continue;
    }
    push("punct", rest[0] ?? "");
    i += 1;
  }
  return out;
}
