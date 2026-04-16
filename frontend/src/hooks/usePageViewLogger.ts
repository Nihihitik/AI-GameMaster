import { useEffect, useRef } from 'react';
import { logger } from '../services/logger';

export function usePageViewLogger(page: string, details?: Record<string, unknown>): void {
  const detailsRef = useRef(details);

  useEffect(() => {
    logger.business('page.view', `${page} opened`, detailsRef.current, { page });
  }, [page]);
}
