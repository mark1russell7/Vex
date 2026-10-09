/**
 * A program and its expression: the code that the reader writes, next to the JSON data that the builder makes.
 * The build renders it from the real builder.
 */
import { serialize } from "@mark1russell7/vex";
import type { ReactElement } from "react";
import { programById } from "../lib/programs.ts";
import { DOMAINS, INITIAL_BOXES, rootOf } from "../lib/specimen.ts";

/** The view of one program. */
export default function ProgramIR(props: { readonly program: string }): ReactElement {
  const p = programById(props.program);
  if (p === undefined) return <p className="vx-muted">There is no program with the id {props.program}.</p>;
  const text = serialize(p.build(rootOf(INITIAL_BOXES)), DOMAINS);
  const json = text.ok ? JSON.stringify(JSON.parse(text.value) as unknown, null, 2) : text.error.message;
  return (
    <section className="vx-frame" aria-label={`The program ${p.title} and its expression`}>
      <header>
        <strong>{p.title}</strong>
        <span className="vx-muted">{json.length} characters of JSON</span>
      </header>
      <pre className="vx-code" style={{ borderTop: "none" }}>{p.code}</pre>
      <pre className="vx-code" style={{ maxHeight: "24rem", overflow: "auto" }}>{json}</pre>
    </section>
  );
}
