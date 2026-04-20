import { useCallback, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'error';

export function useCopyToClipboard(resetMs = 1800): {
  state: CopyState;
  copy: (text: string) => Promise<void>;
} {
  const [state, setState] = useState<CopyState>('idle');

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
        setState('copied');
      } catch {
        setState('error');
      }
    }
    setTimeout(() => setState('idle'), resetMs);
  }, [resetMs]);

  return { state, copy };
}
