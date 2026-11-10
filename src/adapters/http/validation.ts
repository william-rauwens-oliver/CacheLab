type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (typeof body.key !== "string" || body.key.length === 0) {
    return { ok: false, message: "key must be a non-empty string" };
  }
  if (typeof body.value !== "string") {
    return { ok: false, message: "value must be a string" };
  }
  return { ok: true, value: { key: body.key, value: body.value } };
}

export function validateRouteKey(key: unknown): ValidationResult<string> {
  if (typeof key !== "string" || key.length === 0) {
    return { ok: false, message: "key must be a non-empty string" };
  }
  return { ok: true, value: key };
}
