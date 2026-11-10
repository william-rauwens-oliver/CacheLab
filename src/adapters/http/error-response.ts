import type { Response } from "express";

export interface ErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function sendError(
  response: Response,
  status: number,
  code: string,
  message: string
): Response {
  const body: ErrorBody = { error: { code, message } };
  return response.status(status).json(body);
}
