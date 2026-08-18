import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MCP server advertises only the allowlisted backend tools", async () => {
  const transport = new StdioClientTransport({
    args: ["mcp/server.mjs"],
    command: process.execPath,
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
      STARLINK_BACKEND_URL: "http://localhost:3000",
      STARLINK_MCP_TOKEN: "test-token",
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "starlink-colombia-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, "conecta-colombia-operations");
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((tool) => tool.name).sort(),
      [
        "get_allocation",
        "get_application",
        "list_allocations",
        "list_applications",
        "promote_application",
        "update_allocation",
        "update_application",
      ],
    );
    const promote = result.tools.find((tool) => tool.name === "promote_application");
    assert.equal(promote.annotations?.destructiveHint, true);
    assert.deepEqual(promote.inputSchema.required?.sort(), ["confirm", "id"]);
  } finally {
    await client.close();
  }
});
