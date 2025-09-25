/** Simple factory wrapper that calls a stored function. */
export class Factory {
  constructor(public readonly fn: (...args:any[]) => any) {}
  invoke(...args:any[]) {
    return this.fn(...args);
  }
}
