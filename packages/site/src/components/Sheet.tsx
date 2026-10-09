/**
 * The spreadsheet lens. Each record is a row and each field is a column. Each program is a computed column:
 * one formula, evaluated at each row. Select a computed cell to see its precedents. The fields that the
 * evaluation read are blue, and a failed read is red. This is the "Trace Precedents" idea of a spreadsheet.
 */
import { evaluate, explain, type Read } from "@mark1russell7/vex";
import { useMemo, useState, type ReactElement } from "react";
import { errorHref, show, showResult } from "../lib/format.ts";
import { PROGRAMS, programById } from "../lib/programs.ts";
import { DOMAINS, rootOf, spaceOf, useBoxes, type BoxKey } from "../lib/specimen.ts";

const KEYS: readonly BoxKey[] = ["A", "B", "C", "D"];
const FIELDS = ["position", "size", "weight", "name"] as const;

/** The properties of the sheet. */
export interface SheetProps {
  /** The ids of the programs of the computed columns. */
  readonly programs?: readonly string[];
}

/** The sheet. */
export default function Sheet(props: SheetProps): ReactElement {
  const boxes = useBoxes();
  const [columns, setColumns] = useState<readonly string[]>(props.programs ?? ["far-corner", "nearest", "overlaps"]);
  const [selected, setSelected] = useState<{ readonly key: BoxKey; readonly program: string } | undefined>({ key: "A", program: (props.programs ?? ["far-corner"])[0] ?? "far-corner" });

  const cells = useMemo(() => {
    const root = rootOf(boxes);
    const s = spaceOf(boxes);
    return Object.fromEntries(
      columns.map((id) => {
        const p = programById(id);
        const expr = p?.build(root);
        return [id, Object.fromEntries(KEYS.map((k) => [k, expr === undefined ? undefined : evaluate(expr, { space: s, origin: k, domains: DOMAINS })]))];
      }),
    );
  }, [boxes, columns]);

  const precedents = useMemo((): readonly Read[] => {
    if (selected === undefined) return [];
    const p = programById(selected.program);
    if (p === undefined) return [];
    const t = explain(p.build(rootOf(boxes)), { space: spaceOf(boxes), origin: selected.key, domains: DOMAINS });
    return t.events.flatMap((e) => e.reads ?? []);
  }, [selected, boxes]);

  const readState = (k: string, field: string): "ok" | "error" | undefined => {
    const hits = precedents.filter((r) => r.key === k && (r.path[0] ?? "") === field);
    if (hits.length === 0) return undefined;
    return hits.some((r) => !r.ok) ? "error" : "ok";
  };

  const selectedProgram = selected === undefined ? undefined : programById(selected.program);

  return (
    <section className="vx-frame" aria-label="The spreadsheet lens">
      <header>
        <strong>The spreadsheet lens</strong>
        <span className="vx-row">
          {PROGRAMS.map((p) => (
            <label key={p.id} className="vx-row" style={{ gap: "0.25rem" }}>
              <input
                type="checkbox"
                checked={columns.includes(p.id)}
                onChange={(e) => setColumns(e.target.checked ? [...columns, p.id] : columns.filter((c) => c !== p.id))}
              />
              <span className="vx-muted">{p.id}</span>
            </label>
          ))}
        </span>
      </header>
      <div className="vx-code" aria-live="polite">
        <span style={{ color: "var(--color-ink-muted)" }}>fx </span>
        {selectedProgram === undefined || selected === undefined ? "Select a computed cell." : `${selected.key}: ${selectedProgram.code.replaceAll("\n", " ")}`}
      </div>
      <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="The cells of the sheet">
        <table className="vx-table">
          <thead>
            <tr>
              <th scope="col">key</th>
              {FIELDS.map((f) => (
                <th key={f} scope="col">
                  {f}
                </th>
              ))}
              {columns.map((id) => (
                <th key={id} scope="col" style={{ background: "var(--color-surface-sunken)" }}>
                  {id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {KEYS.map((k) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                {FIELDS.map((f) => {
                  const st = readState(k, f);
                  return (
                    <td
                      key={f}
                      className={st === "error" ? "vx-cell-error" : st === "ok" ? "vx-cell-focus" : undefined}
                      title={st === undefined ? undefined : `The selected cell reads ${k}.${f}`}
                    >
                      {show(boxes[k][f])}
                    </td>
                  );
                })}
                {columns.map((id) => {
                  const r = cells[id]?.[k];
                  const isSel = selected?.key === k && selected.program === id;
                  return (
                    <td key={id} className={r !== undefined && !r.ok ? "vx-cell-error" : undefined} style={{ background: isSel ? "var(--color-accent-wash)" : undefined }}>
                      <button
                        type="button"
                        onClick={() => setSelected({ key: k, program: id })}
                        aria-pressed={isSel}
                        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", fontFamily: "var(--font-mono)" }}
                      >
                        {r === undefined ? "" : r.ok ? showResult(r) : r.error.code}
                      </button>
                      {r !== undefined && !r.ok ? (
                        <a href={errorHref(r.error.code)} className="vx-muted">
                          why?
                        </a>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="vx-body vx-muted" style={{ margin: 0 }}>
        Blue cells: the fields that the selected cell read. A field name reads at the row of the cell. The axis
        {" "}<code>others</code> reads the same field at each other row.
      </p>
    </section>
  );
}
