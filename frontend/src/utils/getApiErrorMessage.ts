import { ERROR_MESSAGES } from './constants';
import { parseApiError } from './parseApiError';

export function getApiErrorMessage(err: unknown): string {
  const parsed = parseApiError(err);
  return ERROR_MESSAGES[parsed.code] ?? parsed.message;
}
