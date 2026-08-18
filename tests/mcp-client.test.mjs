import assert from "node:assert/strict";
import test from "node:test";
import { BackendRequestError, createBackendClient } from "../mcp/client.mjs";

test("backend client sends bearer authentication and JSON", async () => {
  let captured;
  const client = createBackendClient({
    baseUrl: "https://starlinkcolombia.org",
    fetchImpl: async (url, init) => {
      captured = { init, url: String(url) };
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    token: "operator-token",
  });
  const result = await client.request("/api/admin/applications", {
    body: { id: 12, status: "review" },
    method: "PATCH",
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(captured.url, "https://starlinkcolombia.org/api/admin/applications");
  assert.equal(captured.init.headers.authorization, "Bearer operator-token");
  assert.equal(captured.init.headers["content-type"], "application/json");
  assert.equal(captured.init.body, '{"id":12,"status":"review"}');
  assert.match(captured.init.headers["x-mcp-request-id"], /^[0-9a-f-]{36}$/u);
});

test("backend client rejects insecure remote URLs and surfaces API errors", async () => {
  assert.throws(
    () => createBackendClient({ baseUrl: "http://example.com", token: "token" }),
    /HTTPS/u,
  );
  const client = createBackendClient({
    baseUrl: "http://localhost:3000",
    fetchImpl: async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 }),
    token: "operator-token",
  });
  await assert.rejects(
    () => client.request("/api/admin/applications"),
    (error) => error instanceof BackendRequestError && error.status === 403 && error.message === "Unauthorized",
  );
});

test("backend client preserves multipart evidence and lets fetch set its boundary", async () => {
  let captured;
  const client = createBackendClient({
    baseUrl: "https://starlinkcolombia.org",
    fetchImpl: async (url, init) => {
      captured = { init, url: String(url) };
      return new Response(JSON.stringify({ count: 1, ids: [99], ok: true }), { status: 201 });
    },
    token: "operator-token",
  });
  const form = new FormData();
  form.set("entityType", "application");
  form.set("entityId", "7");
  form.append("files", new File(["proof"], "proof.txt", { type: "text/plain" }));

  const result = await client.request("/api/admin/evidence", {
    body: form,
    method: "POST",
    timeoutMs: 120_000,
  });

  assert.deepEqual(result, { count: 1, ids: [99], ok: true });
  assert.equal(captured.url, "https://starlinkcolombia.org/api/admin/evidence");
  assert.equal(captured.init.body, form);
  assert.equal(captured.init.headers.authorization, "Bearer operator-token");
  assert.equal("content-type" in captured.init.headers, false);
});
