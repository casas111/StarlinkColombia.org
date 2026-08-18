#!/usr/bin/env node
import { MCP_SCOPES, signMcpToken } from "../lib/mcp-token.js";

const options = parseOptions(process.argv.slice(2));
const secret = process.env.MCP_AUTH_SECRET;
if (!secret) fail("MCP_AUTH_SECRET is required");
if (!options.email) fail("--email is required");

const days = Number(options.days ?? 30);
if (!Number.isInteger(days) || days < 1 || days > 365) {
  fail("--days must be an integer between 1 and 365");
}
const scopes = String(options.scopes ?? MCP_SCOPES.join(","))
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);
const issuedAt = Math.floor(Date.now() / 1000);
const token = await signMcpToken({
  expiresAt: issuedAt + days * 86_400,
  issuedAt,
  name: options.name,
  scopes,
  secret,
  subject: options.email,
});

process.stdout.write(`${token}\n`);
console.error(`Created a ${days}-day MCP token for ${String(options.email).toLowerCase()} with scopes: ${scopes.join(", ")}`);

function parseOptions(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail("Arguments must use --key value pairs");
    result[key.slice(2)] = value;
  }
  return result;
}

function fail(message) {
  console.error(`Error: ${message}`);
  console.error("Usage: npm run mcp:token -- --email developer@example.com [--name Name] [--scopes data:read,data:write,operations:promote] [--days 30]");
  process.exit(1);
}
