#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBackendClient } from "./client.mjs";
import { createStarlinkMcpServer } from "./create-server.mjs";

const server = createStarlinkMcpServer({ backend: createBackendClient() });
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Starlink Colombia MCP ready on stdio");
