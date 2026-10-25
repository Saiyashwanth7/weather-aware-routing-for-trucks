import { beforeEach, describe, expect, it } from 'vitest';
import { addHistory, loadHistory } from './history.js';

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

const setStorage = (value) =>
  Object.defineProperty(globalThis, 'localStorage', { value, configurable: true, writable: true });

const trip = (from, to) => ({ origin: { label: from, lat: 1, lng: 2 }, destination: { label: to, lat: 3, lng: 4 } });

beforeEach(() => setStorage(fakeStorage()));

describe('history', () => {
  it('starts empty', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('puts the newest trip first', () => {
    addHistory(trip('A', 'B'));
    addHistory(trip('C', 'D'));
    expect(loadHistory().map((t) => t.origin.label)).toEqual(['C', 'A']);
  });

  it('moves a repeated trip to the top instead of listing it twice', () => {
    addHistory(trip('A', 'B'));
    addHistory(trip('C', 'D'));
    addHistory(trip('A', 'B'));
    expect(loadHistory().map((t) => t.origin.label)).toEqual(['A', 'C']);
  });

  it('keeps only the last 4 trips', () => {
    ['A', 'B', 'C', 'D', 'E'].forEach((x) => addHistory(trip(x, 'Z')));
    expect(loadHistory().map((t) => t.origin.label)).toEqual(['E', 'D', 'C', 'B']);
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem('clearhaul.recent', 'not json');
    expect(loadHistory()).toEqual([]);
  });

  it('does not crash when storage is blocked', () => {
    setStorage({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(addHistory(trip('A', 'B'))).toEqual([trip('A', 'B')]);
  });
});
