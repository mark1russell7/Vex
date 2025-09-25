import { ValueKind } from "../value.enum";
export type ParamSpec = { name: string; kind: ValueKind; optional?: boolean };

export interface DomainAdapter<D> {
  name: string;
  isInstance(v: unknown): v is D;
  getMethod(self: D, name: string): ((...a: any[]) => any) | undefined;
  fromScalar?: (n: number) => D;
  methodReturns?(name: string): ValueKind | undefined;
  methodParams?(name: string): string[] | ParamSpec[];
  partial?(
    self: D,
    op: string,
    boundNames: string[],
    boundValues: any[],
  ): D;
}
