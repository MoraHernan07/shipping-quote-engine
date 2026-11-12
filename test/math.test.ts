import { applyBpsCeil, applyBpsFloor, ceilDiv, divRoundHalfUp, floorDiv } from '../src';

describe('integer math', () => {
  it('divides exactly with floor, ceil and half-up rounding', () => {
    expect(floorDiv(7, 2)).toBe(3);
    expect(ceilDiv(7, 2)).toBe(4);
    expect(ceilDiv(8, 2)).toBe(4);
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(4, 3)).toBe(1);
    expect(floorDiv(0, 5)).toBe(0);
  });

  it('applies basis points rounding down or up', () => {
    expect(applyBpsFloor(999, 6_000)).toBe(599); // 599.4
    expect(applyBpsCeil(999, 6_000)).toBe(600);
    expect(applyBpsCeil(10_000, 405)).toBe(405);
  });

  it('rejects negative, fractional and unsafe inputs', () => {
    expect(() => floorDiv(-1, 2)).toThrow(RangeError);
    expect(() => floorDiv(1.5, 2)).toThrow(RangeError);
    expect(() => floorDiv(1, 0)).toThrow(RangeError);
    expect(() => floorDiv(Number.MAX_SAFE_INTEGER + 1, 2)).toThrow(RangeError);
  });
});
