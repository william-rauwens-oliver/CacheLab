import assert from "node:assert/strict";

export async function assertErrorResponse(
  response,
  { status, code, mustNotContain = [] }
) {
  assert.equal(response.status, status, `statut attendu ${status}`);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);

  const text = await response.text();
  const body = JSON.parse(text);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.deepEqual(Object.keys(body.error).sort(), ["code", "message"]);
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.notEqual(body.error.message, "");

  for (const forbidden of mustNotContain) {
    assert.ok(!text.includes(forbidden), `le corps d'erreur ne doit pas contenir « ${forbidden} »`);
  }
  return body;
}