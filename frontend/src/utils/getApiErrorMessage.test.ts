import { getApiErrorMessage } from './getApiErrorMessage';
import { parseApiError } from './parseApiError';

jest.mock('./parseApiError', () => ({
  parseApiError: jest.fn(),
}));

describe('getApiErrorMessage', () => {
  it('returns mapped message for known API error codes', () => {
    (parseApiError as jest.Mock).mockReturnValue({
      code: 'session_not_found',
      message: 'raw message',
      httpStatus: 404,
    });

    expect(getApiErrorMessage(new Error('boom'))).toBe('Сессия не найдена');
  });

  it('falls back to parsed API message for unknown error codes', () => {
    (parseApiError as jest.Mock).mockReturnValue({
      code: 'custom_error',
      message: 'Custom backend message',
      httpStatus: 400,
    });

    expect(getApiErrorMessage(new Error('boom'))).toBe('Custom backend message');
  });
});
