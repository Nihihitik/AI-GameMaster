import { AxiosError } from 'axios';
import { ApiErrorResponse, ErrorCode } from '../types/errors';

export interface ParsedApiError {
  code: ErrorCode | string;
  message: string;
  httpStatus: number;
}

export function parseApiError(err: unknown): ParsedApiError {
  if (err instanceof AxiosError && err.response) {
    const body = err.response.data as ApiErrorResponse;
    if (body?.error) {
      return {
        code: body.error.code,
        message: body.error.message,
        httpStatus: err.response.status,
      };
    }
    return {
      code: 'internal_error',
      message: 'Неизвестная ошибка сервера',
      httpStatus: err.response.status,
    };
  }
  return { code: 'internal_error', message: 'Нет связи с сервером', httpStatus: 0 };
}
