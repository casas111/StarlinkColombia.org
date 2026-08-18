import assert from "node:assert/strict";
import test from "node:test";
import { signMcpToken, verifyMcpToken } from "../lib/mcp-token.js";

const secret = "test-secret-that-is-longer-than-thirty-two-characters";

test("MCP tokens preserve an operator and allowed scopes", async () => {
  const token = await signMcpToken({
    expiresAt: 2_000,
    issuedAt: 1_000,
    name: "Developer One",
    scopes: ["data:read", "data:write"],
    secret,
    subject: "Developer@Example.com",
    tokenId: "test-token-id",
  });
  const claims = await verifyMcpToken(token, secret, 1_500);
  assert.deepEqual(claims, {
    expiresAt: 2_000,
    issuedAt: 1_000,
    name: "Developer One",
    scopes: ["data:read", "data:write"],
    subject: "developer@example.com",
    tokenId: "test-token-id",
  });
});

test("MCP tokens reject tampering, expiration, and unsupported scopes", async () => {
  const token = await signMcpToken({
    expiresAt: 2_000,
    issuedAt: 1_000,
    scopes: ["data:read"],
    secret,
    subject: "developer@example.com",
    tokenId: "test-token-id",
  });
  await assert.rejects(() => verifyMcpToken(`${token}x`, secret, 1_500), /signature/u);
  await assert.rejects(() => verifyMcpToken(token, secret, 2_000), /expired/u);
  await assert.rejects(
    () =>
      signMcpToken({
        expiresAt: 2_000,
        issuedAt: 1_000,
        scopes: ["sql:write"],
        secret,
        subject: "developer@example.com",
      }),
    /unsupported/u,
  );
});
