#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { createBackendClient } from "./client.mjs";

const backend = createBackendClient();
const stages = ["new", "review", "prioritized", "approved", "delivery", "active", "declined"];

const server = new McpServer(
  { name: "starlink-colombia", version: "0.1.0" },
  {
    instructions:
      "Use read tools first. Only mutate production data when the user has explicitly requested the exact change. Promotion requires confirm=true and creates a pending Google Sheets synchronization. This server never exposes arbitrary SQL, credentials, or R2 objects.",
  },
);

server.registerTool(
  "list_applications",
  {
    annotations: { readOnlyHint: true },
    description: "List and filter Starlink requests. Production data is read-only for this tool.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(50),
      query: z.string().trim().max(200).optional(),
      status: z.enum(stages).optional(),
    },
  },
  runTool(async ({ limit, query, status }) => {
    const result = await backend.request("/api/admin/applications");
    const applications = filterRows(result.applications, { query, status, statusField: "status" });
    return { applications: applications.slice(0, limit), totalMatched: applications.length };
  }),
);

server.registerTool(
  "get_application",
  {
    annotations: { readOnlyHint: true },
    description: "Get one Starlink request by numeric ID or reference.",
    inputSchema: {
      id: z.number().int().positive().optional(),
      reference: z.string().trim().min(1).max(200).optional(),
    },
  },
  runTool(async ({ id, reference }) => {
    if (!id && !reference) throw new Error("Provide id or reference");
    const result = await backend.request("/api/admin/applications");
    const application = result.applications?.find(
      (row) => (id && row.id === id) || (reference && row.reference === reference),
    );
    if (!application) throw new Error("Application not found");
    return { application };
  }),
);

server.registerTool(
  "update_application",
  {
    annotations: { idempotentHint: true, readOnlyHint: false },
    description: "Update an existing Starlink request. Only send fields the user explicitly asked to change.",
    inputSchema: {
      assigneeEmail: z.union([z.email(), z.literal("")]).optional(),
      id: z.number().int().positive(),
      notes: z.string().max(2000).optional(),
      status: z.enum(stages).optional(),
      updates: z
        .object({
          city: z.string().max(500).optional(),
          continuityPlan: z.string().max(500).optional(),
          deliveryTiming: z.string().max(500).optional(),
          department: z.string().max(500).optional(),
          email: z.string().max(500).optional(),
          impact: z.string().max(4000).optional(),
          location: z.string().max(500).optional(),
          organization: z.string().max(500).optional(),
          organizationType: z.string().max(500).optional(),
          phone: z.string().max(500).optional(),
          powerAvailable: z.string().max(500).optional(),
          requestedDeliveryAt: z.string().max(500).optional(),
          responsibleName: z.string().max(500).optional(),
          responsibleRole: z.string().max(500).optional(),
          safeInstallation: z.string().max(500).optional(),
          units: z.number().int().min(1).max(100).optional(),
          useCase: z.string().max(4000).optional(),
        })
        .strict()
        .optional(),
    },
  },
  runTool(async (input) => {
    const result = await backend.request("/api/admin/applications", { body: input, method: "PATCH" });
    return { ...result, applicationId: input.id };
  }),
);

server.registerTool(
  "list_allocations",
  {
    annotations: { readOnlyHint: true },
    description: "List and filter imported Starlink allocation rows, including portal overrides.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(50),
      query: z.string().trim().max(200).optional(),
      stage: z.enum(stages).optional(),
    },
  },
  runTool(async ({ limit, query, stage }) => {
    const result = await backend.request("/api/admin/allocations");
    const allocations = filterRows(result.allocations, { query, status: stage, statusField: "portalStage" });
    return { allocations: allocations.slice(0, limit), totalMatched: allocations.length };
  }),
);

server.registerTool(
  "get_allocation",
  {
    annotations: { readOnlyHint: true },
    description: "Get one imported allocation by its Google Sheet source row.",
    inputSchema: { sourceRow: z.number().int().positive() },
  },
  runTool(async ({ sourceRow }) => {
    const result = await backend.request("/api/admin/allocations");
    const allocation = result.allocations?.find((row) => row.sourceRow === sourceRow);
    if (!allocation) throw new Error("Allocation not found");
    return { allocation };
  }),
);

server.registerTool(
  "update_allocation",
  {
    annotations: { idempotentHint: true, readOnlyHint: false },
    description: "Write a portal override for an imported allocation. Source Sheet data is not overwritten.",
    inputSchema: {
      assigneeEmail: z.union([z.email(), z.literal("")]).optional(),
      sourceRow: z.number().int().positive(),
      updates: z
        .object({
          activated: z.string().max(500).optional(),
          agreement: z.string().max(500).optional(),
          city: z.string().max(500).optional(),
          contact: z.string().max(500).optional(),
          finalDestination: z.string().max(4000).optional(),
          institution: z.string().max(500).optional(),
          kit: z.string().max(4000).optional(),
          logistics: z.string().max(500).optional(),
          portalStage: z.enum(stages).optional(),
          receivedId: z.string().max(500).optional(),
          receivedName: z.string().max(500).optional(),
          receivedPhone: z.string().max(500).optional(),
          terminal: z.string().max(500).optional(),
          terminalProvider: z.string().max(500).optional(),
          type: z.string().max(500).optional(),
          units: z.number().int().min(1).max(100).optional(),
        })
        .strict()
        .optional(),
    },
  },
  runTool(async (input) => {
    const result = await backend.request("/api/admin/allocations", { body: input, method: "PATCH" });
    return { ...result, sourceRow: input.sourceRow };
  }),
);

server.registerTool(
  "promote_application",
  {
    annotations: { destructiveHint: true, idempotentHint: true, readOnlyHint: false },
    description: "Promote a request into the operations queue. Requires the user's explicit confirmation.",
    inputSchema: {
      confirm: z.literal(true).describe("Must be true after explicit user confirmation"),
      id: z.number().int().positive(),
    },
  },
  runTool(async (input) => backend.request("/api/admin/promote", { body: input, method: "POST" })),
);

function filterRows(value, { query, status, statusField }) {
  const rows = Array.isArray(value) ? value : [];
  const needle = query?.toLocaleLowerCase("es-CO");
  return rows.filter((row) => {
    if (status && (row?.[statusField] ?? row?.stage) !== status) return false;
    if (!needle) return true;
    return JSON.stringify(row).toLocaleLowerCase("es-CO").includes(needle);
  });
}

function runTool(callback) {
  return async (input) => {
    try {
      const value = await callback(input);
      return {
        content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
        structuredContent: value,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected MCP error";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Starlink Colombia MCP ready on stdio");
