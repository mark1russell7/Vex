/**
 * Highlighted Vex code. The component gives one span for each piece of `lib/highlight.ts`, and the classes
 * `vx-syn-*` of the theme give the colours. The caller supplies the `pre` or the `code` around it.
 * The optional `mark` is a range of the text, for example the position of an error. The component puts that range in
 * a `mark` element with a wavy underline.
 */
import type { ReactElement, ReactNode } from "react";
import { highlight } from "../lib/highlight.ts";

/** The pieces of `code`, as spans with a class for each kind. */
export function Code(props: { readonly code: string; readonly mark?: { readonly start: number; readonly end: number } | undefined }): ReactElement {
  const { code, mark } = props;
  // An empty range at the end of the text marks one space after the text. An empty range in the text marks one character.
  const start = mark === undefined ? -1 : Math.min(mark.start, code.length);
  const end = mark === undefined ? -1 : Math.max(mark.end, Math.min(start + 1, code.length));
  const out: ReactNode[] = [];
  let at = 0;
  for (const [i, p] of highlight(code).entries()) {
    const from = at;
    at += p.text.length;
    const parts = start < 0 || at <= start || from >= end ? [[p.text, false] as const] : [[p.text.slice(0, Math.max(0, start - from)), false] as const, [p.text.slice(Math.max(0, start - from), end - from), true] as const, [p.text.slice(end - from), false] as const];
    for (const [j, [text, marked]] of parts.entries()) {
      if (text === "") continue;
      const piece = p.kind === "plain" ? text : <span className={`vx-syn-${p.kind}`}>{text}</span>;
      out.push(marked ? <mark key={`${i}-${j}`} className="vx-syn-error">{piece}</mark> : p.kind === "plain" ? piece : <span key={`${i}-${j}`} className={`vx-syn-${p.kind}`}>{text}</span>);
    }
  }
  if (start >= 0 && start === code.length) out.push(<mark key="end" className="vx-syn-error"> </mark>);
  return <>{out}</>;
}
