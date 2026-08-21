import { NextResponse } from "next/server";

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RequestValidationError("Request body must be a JSON object.");
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError("Request body must contain valid JSON.");
  }
}

export function requiredString(value: unknown, field: string, maxLength = 500): string {
  if (typeof value !== "string") throw new RequestValidationError(`${field} is required.`);
  const normalized = value.trim();
  if (!normalized) throw new RequestValidationError(`${field} is required.`);
  if (normalized.length > maxLength) throw new RequestValidationError(`${field} is too long.`);
  return normalized;
}

export function validId(value: unknown, field: string): string {
  const id = requiredString(value, field, 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new RequestValidationError(`${field} is invalid.`);
  return id;
}

export function validationErrorResponse(error: unknown) {
  return error instanceof RequestValidationError
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : null;
}
