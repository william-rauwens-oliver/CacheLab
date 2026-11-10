export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateKey(key: unknown): ValidationResult<string> {
  if (typeof key !== "string" || key.length === 0) {
    return { ok: false, message: "key must be a non-empty string" };
  }
  return { ok: true, value: key };
}

export function validateCreateBody(
  body: unknown
): ValidationResult<{ key: string; value: string }> {
  if (!isRecord(body)) {
    return { ok: false, message: "Body must be a JSON object" };
  }
  const fields = Object.keys(body);
  if (fields.some((field) => field !== "key" && field !== "value")) {
    return { ok: false, message: "Body must only contain key and value" };
  }
  const keyResult = validateKey(body.key);
  if (!keyResult.ok) {
    return keyResult;
  }
  if (typeof body.value !== "string") {
    return { ok: false, message: "value must be a string" };
  }
  return { ok: true, value: { key: keyResult.value, value: body.value } };
}

export function validateUpdateBody(
  body: unknown
): ValidationResult<{ value: string }> {
  if (!isRecord(body)) {
    return { ok: false, message: "Body must be a JSON object" };
  }
  const fields = Object.keys(body);
  if (fields.some((field) => field !== "value")) {
    return { ok: false, message: "Body must only contain value" };
  }
  if (typeof body.value !== "string") {
    return { ok: false, message: "value must be a string" };
  }
  return { ok: true, value: { value: body.value } };
}

export function validateKeyParam(key: unknown): ValidationResult<string> {
  return validateKey(key);
}
