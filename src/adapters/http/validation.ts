export type UpdateEntryInput = {
  readonly value: string;
};

export function validateUpdateEntryInput(
  body: unknown
): UpdateEntryInput | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const fields = Object.keys(record);
  if (
    fields.length !== 1 ||
    fields[0] !== "value" ||
    typeof record.value !== "string"
  ) {
    return undefined;
  }

  return { value: record.value };
}
