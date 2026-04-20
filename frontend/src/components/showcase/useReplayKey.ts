import { useCallback, useState } from 'react';

export function useReplayKey(): { key: number; replay: () => void } {
  const [key, setKey] = useState(0);
  const replay = useCallback(() => setKey((k) => k + 1), []);
  return { key, replay };
}
