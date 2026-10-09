/**
 * The Lab. The reader picks a space (boxes, a Life grid, a tree or rows). Then the reader writes a Vex chain, or
 * starts from a preset. The Lab reads the chain with the safe reader of `lib/chain-parser.ts`. It evaluates the chain
 * at each record, and draws the results on the canvas of the space. It shows the trace at the selected origin and the
 * program as JSON.
 * "Copy link" puts the space and the code in the address, so a link opens the same program.
 */
import { domainOf, evaluate, explain, isVexList, serialize, type Expr, type Result } from "@mark1russell7/vex";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { ChainError, parseChain, runChain } from "../lib/chain-parser.ts";
import { errorHref, show, showResult } from "../lib/format.ts";
import { LAB_SPACES, labSpace, type LabSpaceId } from "../lib/lab-spaces.ts";
import { resetBoxes, useBoxes } from "../lib/specimen.ts";
import { LabCanvas } from "./LabCanvas.tsx";

const REDUCTIONS = ["min()", "max()", "sum()", "mean()", "count()", "any()", "all()", "values()", "first()"] as const;

/** This function encodes the state of the Lab for the address: base64url of JSON. */
function encode(state: { readonly s: string; readonly c: string }): string {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** This function decodes the state of the Lab from the address, or gives `undefined`. */
function decode(text: string): { readonly s: string; readonly c: string } | undefined {
  try {
    const bin = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    const json: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    if (typeof json === "object" && json !== null && typeof (json as { s?: unknown }).s === "string" && typeof (json as { c?: unknown }).c === "string") {
      return json as { readonly s: string; readonly c: string };
    }
  } catch {
    // A broken link opens the default program.
  }
  return undefined;
}

/** This function gives the line and the column of a position in the text. */
function lineCol(text: string, at: number): string {
  const before = text.slice(0, at).split("\n");
  return `line ${before.length}, column ${(before.at(-1)?.length ?? 0) + 1}`;
}

/** The Lab. */
export default function Lab(): ReactElement {
  const boxes = useBoxes();
  const [spaceId, setSpaceId] = useState<LabSpaceId>("boxes");
  const def = labSpace(spaceId);
  const [code, setCode] = useState<string>(def.presets[0]?.code ?? "");
  const [origin, setOrigin] = useState<string>("A");
  const [copied, setCopied] = useState(false);

  // A link with "#lab=..." opens its space and its code.
  useEffect(() => {
    const m = /#lab=([\w-]+)/.exec(window.location.hash);
    const state = m?.[1] === undefined ? undefined : decode(m[1]);
    if (state === undefined) return;
    const s = labSpace(state.s);
    setSpaceId(s.id);
    setCode(state.c);
    setOrigin(s.make(boxes).space.keys[0] ?? "");
    // The link is read once, when the Lab opens.
  }, []);

  const { space: sp, root } = useMemo(() => def.make(boxes), [def, boxes]);
  const keys = sp.keys;
  const at = keys.includes(origin) ? origin : (keys[0] ?? "");

  const built = useMemo((): { readonly program: Expr } | { readonly error: ChainError } => {
    try {
      const chain = runChain(parseChain(code), { root });
      const program = (chain as { readonly program?: unknown } | null)?.program;
      if (program === undefined) throw new ChainError("the program must end with a chain, for example root.from(...)", { start: 0, end: code.length });
      return { program: program as Expr };
    } catch (e) {
      return { error: e instanceof ChainError ? e : new ChainError(String(e), { start: 0, end: code.length }) };
    }
  }, [code, root]);

  const program = "program" in built ? built.program : undefined;
  const results = useMemo(() => {
    const m = new Map<string, Result<unknown>>();
    if (program === undefined) return m;
    for (const k of keys) m.set(k, evaluate(program, { space: sp, origin: k, domains: def.domains }));
    return m;
  }, [program, sp, keys, def]);
  const trace = useMemo(() => (program === undefined ? undefined : explain(program, { space: sp, origin: at, domains: def.domains })), [program, sp, at, def]);
  const current = results.get(at);
  const value = current?.ok === true ? current.value : undefined;
  const domain = value === undefined ? undefined : domainOf(def.domains, value);
  const json = useMemo(() => {
    if (program === undefined) return "";
    const t = serialize(program, def.domains);
    return t.ok ? JSON.stringify(JSON.parse(t.value) as unknown, null, 2) : t.error.message;
  }, [program, def]);

  const pickSpace = (id: LabSpaceId): void => {
    const s = labSpace(id);
    setSpaceId(id);
    setCode(s.presets[0]?.code ?? "");
    setOrigin(s.make(boxes).space.keys[0] ?? "");
  };
  const append = (text: string): void => setCode((c) => `${c.trimEnd()}${text}`);
  const copyLink = (): void => {
    const url = `${window.location.origin}${window.location.pathname}#lab=${encode({ s: spaceId, c: code })}`;
    window.history.replaceState(null, "", url);
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="vx-frame vx-lab" aria-label="The Lab">
      <header>
        <span className="vx-row" role="tablist" aria-label="The space">
          {LAB_SPACES.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === spaceId} className="vx-button" aria-pressed={s.id === spaceId} onClick={() => pickSpace(s.id)}>
              {s.title}
            </button>
          ))}
        </span>
        <span className="vx-row">
          {spaceId === "boxes" ? (
            <button type="button" className="vx-button" onClick={resetBoxes}>
              Reset boxes
            </button>
          ) : null}
          <button type="button" className="vx-button" data-variant="primary" onClick={copyLink}>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </span>
      </header>
      <p className="vx-body vx-muted" style={{ margin: 0, paddingBottom: 0 }}>
        {def.summary}
      </p>
      <div className="vx-body vx-lab-grid">
        <div className="vx-lab-editor">
          <label className="vx-row" style={{ marginBottom: "var(--space-2)" }}>
            <span className="vx-muted">preset</span>
            <select
              className="vx-button"
              aria-label="A preset program"
              value={def.presets.find((p) => p.code === code)?.id ?? ""}
              onChange={(e) => {
                const p = def.presets.find((x) => x.id === e.target.value);
                if (p !== undefined) setCode(p.code);
              }}
            >
              <option value="">(your program)</option>
              {def.presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <textarea
            className="vx-lab-code"
            aria-label="The Vex chain"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={Math.min(14, Math.max(5, code.split("\n").length + 1))}
          />
          {"error" in built ? (
            <p className="vx-lab-error" role="alert">
              <strong>{lineCol(code, built.error.span.start)}:</strong> {built.error.message}
            </p>
          ) : (
            <p className="vx-muted vx-lab-hint">
              The Lab reads the chain as you type. It knows <code>root</code>, <code>const</code> lines and arrow functions.
            </p>
          )}
          <div className="vx-row vx-lab-chips">
            {domain !== undefined ? (
              <>
                <span className="vx-muted">ops of {domain.name} at {at}:</span>
                {Object.keys(domain.ops)
                  .slice(0, 18)
                  .map((op) => (
                    <button key={op} type="button" className="vx-chip" onClick={() => append(`._.${op}()`)}>
                      {op}
                    </button>
                  ))}
              </>
            ) : isVexList(value) ? (
              <>
                <span className="vx-muted">reduce the list:</span>
                {REDUCTIONS.map((r) => (
                  <button key={r} type="button" className="vx-chip" onClick={() => append(`.${r}`)}>
                    {r}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
        <div className="vx-lab-canvas">
          <LabCanvas space={spaceId} boxes={boxes} results={results} origin={at} onSelect={setOrigin} />
        </div>
      </div>
      <details className="vx-body" open={keys.length <= 8}>
        <summary>The result at each of the {keys.length} records</summary>
      <table className="vx-table" aria-label="The result at each record">
        <tbody>
          {keys.map((k) => {
            const r = results.get(k);
            return (
              <tr key={k} style={{ background: k === at ? "var(--color-accent-wash)" : undefined }}>
                <th scope="row">
                  <button type="button" onClick={() => setOrigin(k)} style={{ all: "unset", cursor: "pointer" }}>
                    {k}
                  </button>
                </th>
                <td className={r === undefined || r.ok ? undefined : "vx-cell-error"}>
                  {r === undefined ? "" : r.ok ? show(r.value) : <a href={errorHref(r.error.code)}>{showResult(r)}</a>}
                  {r !== undefined && !r.ok ? <span className="vx-muted"> {r.error.message}</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </details>
      <details className="vx-body">
        <summary>The trace at {at}</summary>
        <ol style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", listStyle: "none", paddingLeft: 0 }}>
          {trace?.events.map((e, i) => (
            <li key={i} style={{ paddingLeft: `${Math.min(e.path.length, 8)}ch` }}>
              {e.label.startsWith(e.tag) ? "" : `${e.tag} `}
              {e.label} @{e.focus} → {e.result.ok ? show(e.result.value) : e.result.error.code}
            </li>
          ))}
        </ol>
      </details>
      <details className="vx-body">
        <summary>The program as JSON</summary>
        <pre className="vx-code" style={{ maxHeight: "18rem", overflow: "auto" }}>
          {json}
        </pre>
      </details>
    </section>
  );
}
