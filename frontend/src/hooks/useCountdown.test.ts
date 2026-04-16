import { computeRemainingSeconds } from './useCountdown';

describe('computeRemainingSeconds', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses fallback when timer seconds are missing', () => {
    expect(computeRemainingSeconds(null, null, 42)).toBe(42);
  });

  it('returns raw timer value when timer_started_at is invalid', () => {
    expect(computeRemainingSeconds(30, 'not-a-date', 42)).toBe(30);
  });

  it('clamps elapsed countdown to zero', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-16T10:00:10.000Z'));

    expect(computeRemainingSeconds(5, '2026-04-16T10:00:00.000Z', 42)).toBe(0);
  });
});
