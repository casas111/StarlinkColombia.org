import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMcpHttpHandler } from "../mcp/http.mjs";
import { MCP_TOOL_NAMES } from "../mcp/create-server.mjs";

function createHandler({ onEvidence } = {}) {
  return createMcpHttpHandler({
    authorize: async (request) => request.headers.get("authorization") === "Bearer operator-token",
    createBackend: () => ({
      async request(path, options) {
        if (path === "/api/admin/applications") {
          return { applications: [{ id: 7, organization: "Test Organization", status: "new" }] };
        }
        if (path === "/api/admin/allocations") return { allocations: [] };
        if (path === "/api/admin/evidence") {
          onEvidence?.(options);
          return { count: 1, ids: [88], ok: true };
        }
        throw new Error(`Unexpected backend request: ${path}`);
      },
    }),
  });
}

test("remote MCP rejects unauthenticated requests and advertises CORS", async () => {
  const handler = createHandler();
  const response = await handler(
    new Request("https://starlinkcolombia.org/api/mcp", {
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      headers: { accept: "application/json, text/event-stream", "content-type": "application/json" },
      method: "POST",
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(
    response.headers.get("www-authenticate"),
    'Bearer realm="starlink-colombia-mcp", resource_metadata="https://starlinkcolombia.org/.well-known/oauth-protected-resource", scope="data:read data:write operations:promote"',
  );
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

test("remote MCP completes Streamable HTTP initialization, tool discovery, and a read call", async () => {
  let evidenceRequest;
  const handler = createHandler({ onEvidence: (options) => { evidenceRequest = options; } });
  const transport = new StreamableHTTPClientTransport(
    new URL("https://starlinkcolombia.org/api/mcp"),
    {
      fetch: (input, init) => handler(new Request(input, init)),
      requestInit: { headers: { authorization: "Bearer operator-token" } },
    },
  );
  const client = new Client({ name: "starlink-colombia-http-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, "starlink-colombia");
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), MCP_TOOL_NAMES);
    const result = await client.callTool({ name: "list_applications", arguments: { limit: 1 } });
    assert.deepEqual(result.structuredContent, {
      applications: [{ id: 7, organization: "Test Organization", status: "new" }],
      totalMatched: 1,
    });
    const evidence = await client.callTool({
      name: "attach_application_evidence",
      arguments: {
        applicationId: 7,
        category: "delivery",
        files: [
          {
            contentBase64: Buffer.from("delivery proof").toString("base64"),
            contentType: "text/plain",
            fileName: "proof.txt",
          },
        ],
        note: "Received locally",
      },
    });
    assert.deepEqual(evidence.structuredContent, { count: 1, ids: [88], ok: true });
    assert.equal(evidenceRequest.method, "POST");
    assert.equal(evidenceRequest.timeoutMs, 120_000);
    assert.equal(evidenceRequest.body.get("entityType"), "application");
    assert.equal(evidenceRequest.body.get("entityId"), "7");
    assert.equal(evidenceRequest.body.get("category"), "delivery");
    assert.equal(evidenceRequest.body.get("note"), "Received locally");
    const [file] = evidenceRequest.body.getAll("files");
    assert.equal(file.name, "proof.txt");
    assert.equal(file.type, "text/plain");
    assert.equal(await file.text(), "delivery proof");
  } finally {
    await client.close();
  }
});
