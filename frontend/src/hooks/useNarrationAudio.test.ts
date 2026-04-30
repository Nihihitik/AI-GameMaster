import { pickPosition } from './useNarrationAudio';

describe('pickPosition', () => {
  it('returns null for empty segments', () => {
    expect(pickPosition([], 1000, 2000)).toBeNull();
  });

  it('returns {0, 0} when startedAtMs is NaN', () => {
    const segs = [{ url: '/a.mp3', duration_ms: 5000 }];
    expect(pickPosition(segs, NaN, 1000)).toEqual({ index: 0, offsetMs: 0 });
  });

  it('returns {0, 0} when now < startedAtMs (clock skew)', () => {
    const segs = [{ url: '/a.mp3', duration_ms: 5000 }];
    expect(pickPosition(segs, 2000, 1000)).toEqual({ index: 0, offsetMs: 0 });
  });

  it('single segment, elapsed inside → {0, elapsed}', () => {
    const segs = [{ url: '/a.mp3', duration_ms: 5000 }];
    expect(pickPosition(segs, 1000, 3500)).toEqual({ index: 0, offsetMs: 2500 });
  });

  it('single segment, elapsed past duration → null', () => {
    const segs = [{ url: '/a.mp3', duration_ms: 5000 }];
    expect(pickPosition(segs, 1000, 7000)).toBeNull();
  });

  it('multi-segment, elapsed lands in second segment', () => {
    const segs = [
      { url: '/a.mp3', duration_ms: 3000 },
      { url: '/b.mp3', duration_ms: 4000 },
      { url: '/c.mp3', duration_ms: 2000 },
    ];
    // startedAt=1000, now=5500 → elapsed=4500. seg0 ends at 3000, seg1 covers 3000..7000.
    expect(pickPosition(segs, 1000, 5500)).toEqual({ index: 1, offsetMs: 1500 });
  });

  it('multi-segment, elapsed past total → null', () => {
    const segs = [
      { url: '/a.mp3', duration_ms: 3000 },
      { url: '/b.mp3', duration_ms: 4000 },
    ];
    expect(pickPosition(segs, 1000, 9000)).toBeNull();
  });

  it('multi-segment, elapsed exactly at boundary → next segment, offset 0', () => {
    const segs = [
      { url: '/a.mp3', duration_ms: 3000 },
      { url: '/b.mp3', duration_ms: 4000 },
    ];
    // elapsed=3000 exactly: not <3000, so falls into seg1 with offset 0.
    expect(pickPosition(segs, 1000, 4000)).toEqual({ index: 1, offsetMs: 0 });
  });

  it('handles segment with 0 or missing duration_ms by skipping it', () => {
    const segs = [
      { url: '/a.mp3', duration_ms: 0 },
      { url: '/b.mp3', duration_ms: 5000 },
    ];
    expect(pickPosition(segs, 1000, 3000)).toEqual({ index: 1, offsetMs: 2000 });
  });

  it('startedAtMs == now → {0, 0}', () => {
    const segs = [{ url: '/a.mp3', duration_ms: 5000 }];
    expect(pickPosition(segs, 1000, 1000)).toEqual({ index: 0, offsetMs: 0 });
  });
});
