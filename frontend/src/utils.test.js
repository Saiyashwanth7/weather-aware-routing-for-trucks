import { describe, expect, it } from 'vitest';
import { blendLevel, bracket, buildPieces, colorAt, fmtDuration, pointAt } from './utils.js';

describe('colorAt', () => {
  it('returns the exact palette colour at whole levels', () => {
    expect(colorAt(0)).toBe('rgb(47,158,91)');
    expect(colorAt(4)).toBe('rgb(107,33,168)');
  });

  it('blends halfway between two levels', () => {
    expect(colorAt(0.5)).toBe('rgb(137,170,48)');
  });

  it('clamps values outside 0..4', () => {
    expect(colorAt(-3)).toBe(colorAt(0));
    expect(colorAt(9)).toBe(colorAt(4));
  });
});

describe('pointAt', () => {
  const path = [[0, 0, 0], [0, 10, 100]];

  it('interpolates along the path', () => {
    expect(pointAt(path, 50)).toEqual([0, 5]);
  });

  it('clamps before the start and after the end', () => {
    expect(pointAt(path, -5)).toEqual([0, 0]);
    expect(pointAt(path, 500)).toEqual([0, 10]);
  });
});

describe('bracket', () => {
  const miles = [0, 10, 20];

  it('finds the two checkpoints around a mile', () => {
    expect(bracket(miles, 15)).toEqual({ a: 1, b: 2, f: 0.5 });
  });

  it('uses the end checkpoints outside the range', () => {
    expect(bracket(miles, -1)).toEqual({ a: 0, b: 0, f: 0 });
    expect(bracket(miles, 25)).toEqual({ a: 2, b: 2, f: 0 });
  });
});

describe('blendLevel', () => {
  it('blends two known levels', () => {
    expect(blendLevel(0, 2, 0.5)).toBe(1);
  });

  it('falls back to the known side when one forecast is missing', () => {
    expect(blendLevel(-1, 2, 0.3)).toBe(2);
    expect(blendLevel(3, -1, 0.3)).toBe(3);
  });

  it('stays missing when both are missing', () => {
    expect(blendLevel(-1, -1, 0.5)).toBe(-1);
  });
});

describe('buildPieces', () => {
  const path = [[0, 0, 0], [0, 10, 100]];

  it('cuts the path into equal-mileage pieces that join up', () => {
    const pieces = buildPieces(path, 4);
    expect(pieces.map((p) => p.mid)).toEqual([12.5, 37.5, 62.5, 87.5]);
    expect(pieces[0].latlngs[0]).toEqual([0, 0]);
    expect(pieces[3].latlngs.at(-1)).toEqual([0, 10]);
    expect(pieces[1].latlngs[0]).toEqual(pieces[0].latlngs.at(-1));
  });
});

describe('fmtDuration', () => {
  it('formats minutes as hours and minutes', () => {
    expect(fmtDuration(45)).toBe('45m');
    expect(fmtDuration(90)).toBe('1h 30m');
    expect(fmtDuration(125)).toBe('2h 05m');
  });
});
