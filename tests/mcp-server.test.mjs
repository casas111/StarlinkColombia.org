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
    assert.equal(client.getServerVersion()?.name, "starlink-colombia");
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((tool) => tool.name).sort(),
      [
        "attach_application_evidence",
        "create_inventory_item",
        "get_allocation",
        "get_application",
        "list_allocations",
        "list_applications",
        "list_inventory",
        "promote_application",
        "update_allocation",
        "update_application",
        "update_inventory_item",
      ],
    );
    const promote = result.tools.find((tool) => tool.name === "promote_application");
    assert.equal(promote.annotations?.destructiveHint, true);
    assert.deepEqual(promote.inputSchema.required?.sort(), ["confirm", "id"]);
    const attach = result.tools.find((tool) => tool.name === "attach_application_evidence");
    assert.equal(attach.annotations?.idempotentHint, false);
    assert.deepEqual(attach.inputSchema.required?.sort(), ["applicationId", "category", "files"]);
    const createInventory = result.tools.find((tool) => tool.name === "create_inventory_item");
    assert.equal(createInventory.annotations?.idempotentHint, false);
    assert.deepEqual(createInventory.inputSchema.required?.sort(), ["availabilityStatus", "handlerEmail", "location", "name", "sourceType", "units"]);
    const updateApplication = result.tools.find((tool) => tool.name === "update_application");
    assert.match(JSON.stringify(updateApplication.inputSchema.properties.status), /recycle/);
  } finally {
    await client.close();
  }
});
