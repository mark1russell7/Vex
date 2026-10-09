/**
 * The tree explorer: an organization chart as a tree space. The reader selects a person (the origin) and a tree
 * axis. A Vex program gives the targets of the axis, and a second program gives the cost of the team of the person.
 */
import { space, vex } from "@mark1russell7/vex";
import { NumDomain } from "@mark1russell7/vex-domains";
import { useMemo, useState, type ReactElement } from "react";

const PEOPLE = {
  ceo: { name: "Ada", role: "CEO", salary: 300 },
  cto: { name: "Bo", role: "CTO", salary: 200 },
  cfo: { name: "Ed", role: "CFO", salary: 190 },
  dev1: { name: "Cy", role: "Developer", salary: 100 },
  dev2: { name: "Di", role: "Developer", salary: 110 },
  ops: { name: "Fa", role: "Operations", salary: 120 },
  acct: { name: "Gu", role: "Accountant", salary: 90 },
} as const;
type Person = keyof typeof PEOPLE;

const PARENTS: Readonly<Partial<Record<Person, Person | null>>> = { cto: "ceo", cfo: "ceo", dev1: "cto", dev2: "cto", ops: "cto", acct: "cfo" };
const POS: Readonly<Record<Person, { readonly x: number; readonly y: number }>> = {
  ceo: { x: 240, y: 36 },
  cto: { x: 140, y: 116 },
  cfo: { x: 360, y: 116 },
  dev1: { x: 50, y: 196 },
  dev2: { x: 140, y: 196 },
  ops: { x: 230, y: 196 },
  acct: { x: 360, y: 196 },
};

const AXES = ["children", "ancestors", "descendants", "siblings"] as const;
type TreeAxis = (typeof AXES)[number];

const org = vex(NumDomain).over(space.tree(PEOPLE, PARENTS));

/** This function gives the program of the targets of an axis: the name at each target. */
function targetsOf(axis: TreeAxis) {
  const start = org.start(0);
  const name = (t: typeof start) => t.from("name");
  switch (axis) {
    case "children":
      return start.children(name).values();
    case "ancestors":
      return start.ancestors(name).values();
    case "descendants":
      return start.descendants(name).values();
    case "siblings":
      return start.siblings(name).values();
  }
}

/** The cost of the team of a person: the salary plus the salaries of the descendants. */
const teamCost = org.from("salary")._.add(org.start(0).descendants((d) => d.from("salary")).sum());

/** The tree explorer. */
export default function TreeExplorer(): ReactElement {
  const [focus, setFocus] = useState<Person>("cto");
  const [axis, setAxis] = useState<TreeAxis>("descendants");
  const names = useMemo(() => {
    const r = targetsOf(axis).result(focus);
    return r.ok ? r.value : [];
  }, [axis, focus]);
  const targets = new Set(names);
  const cost = teamCost.result(focus);

  return (
    <section className="vx-frame" aria-label="The tree explorer">
      <header>
        <strong>An organization chart as a tree space</strong>
        <span className="vx-row" role="group" aria-label="The axis">
          {AXES.map((a) => (
            <button key={a} type="button" className="vx-button" aria-pressed={axis === a} onClick={() => setAxis(a)}>
              {a}
            </button>
          ))}
        </span>
      </header>
      <svg viewBox="0 0 440 236" width="100%" style={{ maxHeight: 300 }} role="img" aria-label="The people of the organization. The targets of the axis have a dark fill.">
        {(Object.keys(PARENTS) as Person[]).map((k) => {
          const p = PARENTS[k];
          if (p === undefined || p === null) return null;
          return <line key={k} x1={POS[p].x} y1={POS[p].y + 18} x2={POS[k].x} y2={POS[k].y - 18} stroke="var(--color-rule-strong)" strokeWidth={1.5} />;
        })}
        {(Object.keys(PEOPLE) as Person[]).map((k) => {
          const person = PEOPLE[k];
          const isFocus = k === focus;
          const isTarget = targets.has(person.name);
          return (
            <g key={k} onClick={() => setFocus(k)} style={{ cursor: "pointer" }} role="button" aria-label={`${person.name}, ${person.role}`}>
              <rect
                x={POS[k].x - 40}
                y={POS[k].y - 18}
                width={80}
                height={36}
                rx={6}
                fill={isTarget ? "var(--color-accent)" : "var(--color-surface)"}
                stroke={isFocus ? "var(--color-mark)" : "var(--color-rule-strong)"}
                strokeWidth={isFocus ? 3 : 1.5}
              />
              <text x={POS[k].x} y={POS[k].y - 2} textAnchor="middle" fontSize={12} fontWeight={700} fill={isTarget ? "var(--color-page)" : "currentColor"}>
                {person.name}
              </text>
              <text x={POS[k].x} y={POS[k].y + 12} textAnchor="middle" fontSize={10} fill={isTarget ? "var(--color-page)" : "currentColor"}>
                {person.salary}
              </text>
            </g>
          );
        })}
      </svg>
      <p data-testid="tree-targets">
        {axis} of {PEOPLE[focus].name}: {names.length === 0 ? "none" : names.join(", ")}
      </p>
      <p className="vx-muted" data-testid="tree-cost">
        The cost of the team of {PEOPLE[focus].name}: {cost.ok ? String(cost.value) : cost.error.code}. Select a person to move the origin.
      </p>
    </section>
  );
}
