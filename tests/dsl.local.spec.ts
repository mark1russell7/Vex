import { describe, it, expect } from 'vitest';
import { annotateOp } from '../dsl/op.meta';
import { ValueKind } from '../dsl/value.enum';
import { mapChain } from '../dsl/chain/base.chain';
import type { DomainAdapter } from '../dsl/domain/domain.adapter';
import { chain, P } from '../dsl/optics.dsl';

/** Dummy domain: 2D point with add/scale */
class Pt {
  constructor(public readonly x:number, public readonly y:number){}
  add(rhs: Pt){ return new Pt(this.x+rhs.x, this.y+rhs.y); }
  scale(k: number){ return new Pt(this.x*k, this.y*k); }
}
annotateOp(Pt.prototype as any, "add",   { commutative: true, associative: true });
annotateOp(Pt.prototype as any, "scale", { /* scalar */ });

const PtAdapter: DomainAdapter<Pt> = {
  name: "Pt",
  isInstance: (v:unknown): v is Pt => v instanceof Pt,
  getMethod: (self: Pt, name: string) => (self as any)[name],
  methodParams(name: string){
    if (name === 'add')   return [{ name:'rhs', kind: ValueKind.Domain }];
    if (name === 'scale') return [{ name:'k',   kind: ValueKind.Scalar }];
    return []; // ✅
  }

};

describe('DSL local + optics', () => {
  const A = { position: new Pt(1,2), size: new Pt(3,4) };
  const B = { position: new Pt(5,6), size: new Pt(7,8) };

  it('local.require prevents malformed call (strict traversal)', () => {
    const t = mapChain<typeof A | typeof B, Pt>(PtAdapter, { A, B })
      .self('A').prop('position')
      .applyUsing('add')   // missing rhs
      .traverseStrict()
      .anyOpt();
    expect(t.tag).toBe('Left'); // none
  });

  it('methodParams auto-order', () => {
    const v = mapChain<typeof A, Pt>(PtAdapter, { A })
      .prop('position')
      .localSetProp('rhs', 'size')
      .applyUsing('add')    // order inferred by adapter
      .value('A');
    expect(v.tag).toBe('Right');
    const p = (v as any).right as Pt;
    expect([p.x, p.y]).toEqual([1+3, 2+4]);
  });

  it('optics: localSetOptic size.x → scale', () => {
    const sizeX = chain(P<any,'size'>('size')).p('x').lens();
    const v = mapChain<typeof A, Pt>(PtAdapter, { A })
      .prop('position')
      .localSetOptic('k', sizeX)  // k = A.size.x = 3
      .applyUsing('scale', ['k'])
      .value('A');
    expect(v.tag).toBe('Right');
    const p = (v as any).right as Pt;
    expect([p.x, p.y]).toEqual([3, 6]);
  });

  it('focus namespace is disjoint from local', () => {
    const v = mapChain<typeof A, Pt>(PtAdapter, { A })
      .prop('position')                 // focus
      .localSetProp('position', 'size') // local['position'] refers to size vector
      .applyUsing('add', ['position'])
      .value('A');
    expect(v.tag).toBe('Right');
    const p = (v as any).right as Pt;
    expect([p.x, p.y]).toEqual([4, 6]);
  });

});
