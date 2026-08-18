#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createBackendClient } from "./client.mjs";
import { createConectaColombiaMcpServer } from "./create-server.mjs";

const server = createConectaColombiaMcpServer({ backend: createBackendClient() });
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Conecta Colombia Operations MCP ready on stdio");
