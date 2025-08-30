import { 
  type ValueKind 
} from "../value.enum";

/* ---------------- Domain Adapter ---------------- */
export interface DomainAdapter<D> {
  name: string;
  /** Type guard */
  isInstance(v: unknown): v is D;
  /** Optional scalar → domain lifter (e.g., Vector.scalar). */
  fromScalar?: (n: number) => D;
  /** Get a method by name on an instance of D. */
  getMethod(self: D, name: string): ((...a: any[]) => any) | undefined;
  /** Optional: refine return kinds of particular methods (for typing/validation). */
  methodReturns?(name: string): ValueKind | undefined;
}