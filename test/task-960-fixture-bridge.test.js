const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseFixtureOutput,
  sanitizeMessage,
  validatePayload
} = require("../tools/task-960-fixture-bridge");

test("validatePayload accepts only the bounded task 960 fixture contract", () => {
  assert.deepEqual(
    validatePayload({
      userId: "00000000-0000-0000-0000-000000000001",
      variant: "fixed",
      count: 2
    }),
    {
      userId: "00000000-0000-0000-0000-000000000001",
      variant: "fixed",
      count: 2
    });

  assert.throws(
    () => validatePayload({ userId: "user@example.com", variant: "fixed", count: 1 }),
    error => error.statusCode === 400 && error.code === "InvalidFixtureUser");
  assert.throws(
    () => validatePayload({ userId: "00000000-0000-0000-0000-000000000001", variant: "other", count: 1 }),
    error => error.statusCode === 400 && error.code === "InvalidFixtureVariant");
  assert.throws(
    () => validatePayload({ userId: "00000000-0000-0000-0000-000000000001", variant: "zonal", count: 3 }),
    error => error.statusCode === 400 && error.code === "InvalidFixtureCount");
});

test("parseFixtureOutput ignores build logs and returns the final AVAILABLE fulfillment", () => {
  const result = parseFixtureOutput([
    "Restore completed.",
    JSON.stringify({
      fulfillmentId: "00000000-0000-0000-0000-000000000002",
      UserId: "00000000-0000-0000-0000-000000000001",
      ProductId: 960001,
      productSubTypeCode: "adult",
      status: "AVAILABLE",
      variant: "fixed"
    })
  ].join("\r\n"));

  assert.equal(result.productId, 960001);
  assert.equal(result.userId, "00000000-0000-0000-0000-000000000001");
  assert.equal(result.productSubTypeCode, "adult");
  assert.equal(result.status, "AVAILABLE");
});

test("sanitizeMessage removes database passwords", () => {
  const result = sanitizeMessage("Host=localhost;Password=secret POSTGRES_PASSWORD=other");
  assert.equal(result.includes("secret"), false);
  assert.equal(result.includes("other"), false);
  assert.equal(result, "Host=localhost;Password=*** POSTGRES_PASSWORD=***");
});
