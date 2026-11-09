export type CreateEntryInput = {
  readonly key: string;
  readonly value: string;
};

export function validateCreateEntryInput(body: unknown): CreateEntryInput | undefined {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }

  const record = body as Record<string, unknown>;
  const fields = Object.keys(record);
  if (
    fields.length !== 2 ||
    !fields.includes("key") ||
    !fields.includes("value") ||
    typeof record.key !== "string" ||
    record.key.trim().length === 0 ||
    typeof record.value !== "string"
  ) {
    return undefined;
  }

  return { key: record.key, value: record.value };
}
