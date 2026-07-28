import { dataFailureDelayMinutes } from './refresh-backoff';

describe('dataFailureDelayMinutes', () => {
  const maxFailures = 5;
  const quarantine = 1440;

  it('escalates 5m → 15m → 60m → 240m before the threshold', () => {
    expect(dataFailureDelayMinutes(1, maxFailures, quarantine)).toBe(5);
    expect(dataFailureDelayMinutes(2, maxFailures, quarantine)).toBe(15);
    expect(dataFailureDelayMinutes(3, maxFailures, quarantine)).toBe(60);
    expect(dataFailureDelayMinutes(4, maxFailures, quarantine)).toBe(240);
  });

  it('quarantines at and past the threshold', () => {
    expect(dataFailureDelayMinutes(5, maxFailures, quarantine)).toBe(1440);
    expect(dataFailureDelayMinutes(9, maxFailures, quarantine)).toBe(1440);
  });

  it('clamps a low threshold to quarantine immediately', () => {
    expect(dataFailureDelayMinutes(1, 1, 60)).toBe(60);
  });
});
