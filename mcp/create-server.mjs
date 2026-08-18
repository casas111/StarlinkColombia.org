import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { MAX_EVIDENCE_FILE_COUNT } from "../lib/evidence-upload.mjs";
import { MAX_EVIDENCE_BASE64_LENGTH, buildApplicationEvidenceFormData } from "./evidence.mjs";

const stages = ["new", "review", "prioritized", "approved", "delivery", "active", "recycle", "declined"];
const inventoryAvailability = ["pending", "scheduled", "available"];
const inventoryStatuses = ["active", "reserved", "archived"];

export const MCP_TOOL_NAMES = [
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
];

export function createStarlinkMcpServer({ backend }) {
  if (!backend || typeof backend.request !== "function") {
    throw new Error("A Starlink backend client is required");
  }

  const server = new McpServer(
    { name: "starlink-colombia", version: "0.4.0" },
    {
      instructions:
        "Conecta Colombia is an independent humanitarian coordination initiative and is not affiliated with, sponsored by, or operated by Starlink or SpaceX. Use read tools first. Only mutate production data when the user has explicitly requested the exact change. Promotion requires confirm=true and creates a pending Google Sheets synchronization. Evidence uploads and inventory creation are not idempotent: perform them only once and never retry automatically. This server never exposes arbitrary SQL, credentials, or raw R2 access.",
    },
  );

  server.registerTool(
    "list_inventory",
    {
      annotations: { readOnlyHint: true },
      description: "List inventory from Recycle and incoming lots, including location, handler, and availability.",
      inputSchema: {
        availabilityStatus: z.enum(inventoryAvailability).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        query: z.string().trim().max(200).optional(),
        sourceType: z.enum(["recycle", "incoming"]).optional(),
        status: z.enum(inventoryStatuses).optional(),
      },
    },
    runTool(async ({ availabilityStatus, limit, query, sourceType, status }) => {
      const result = await backend.request("/api/admin/inventory");
      const needle = query?.toLocaleLowerCase("es-CO");
      const inventory = (Array.isArray(result.inventory) ? result.inventory : []).filter((item) => {
        if (availabilityStatus && item.availabilityStatus !== availabilityStatus) return false;
        if (sourceType && item.sourceType !== sourceType) return false;
        if (status && item.status !== status) return false;
        return !needle || JSON.stringify(item).toLocaleLowerCase("es-CO").includes(needle);
      });
      return { inventory: inventory.slice(0, limit), totalMatched: inventory.length };
    }),
  );

  server.registerTool(
    "create_inventory_item",
    {
      annotations: { destructiveHint: false, idempotentHint: false, readOnlyHint: false },
      description: "Register an incoming or manually recovered inventory lot. Do not retry automatically because a duplicate lot would be created.",
      inputSchema: {
        availabilityStatus: z.enum(inventoryAvailability),
        availableAt: z.string().trim().max(50).optional(),
        handlerEmail: z.email(),
        location: z.string().trim().min(1).max(500),
        name: z.string().trim().min(1).max(250),
        notes: z.string().trim().max(1500).optional(),
        sourceType: z.enum(["recycle", "incoming"]),
        units: z.number().int().min(1).max(1000),
      },
    },
    runTool(async (input) => backend.request("/api/admin/inventory", { body: input, method: "POST" })),
  );

  server.registerTool(
    "update_inventory_item",
    {
      annotations: { idempotentHint: true, readOnlyHint: false },
      description: "Update an inventory lot's location, handler, availability, quantity, notes, or control status.",
      inputSchema: {
        availabilityStatus: z.enum(inventoryAvailability).optional(),
        availableAt: z.string().trim().max(50).optional(),
        handlerEmail: z.email().optional(),
        id: z.number().int().positive(),
        location: z.string().trim().min(1).max(500).optional(),
        name: z.string().trim().min(1).max(250).optional(),
        notes: z.string().trim().max(1500).optional(),
        status: z.enum(inventoryStatuses).optional(),
        units: z.number().int().min(1).max(1000).optional(),
      },
    },
    runTool(async (input) => backend.request("/api/admin/inventory", { body: input, method: "PATCH" })),
  );

  server.registerTool(
    "attach_application_evidence",
    {
      annotations: { destructiveHint: false, idempotentHint: false, readOnlyHint: false },
      description:
        "Attach one or more images or documents to an existing request. File content must be standard base64 without a data-URL prefix. Do not retry automatically because duplicate evidence would be created.",
      inputSchema: {
        applicationId: z.number().int().positive(),
        category: z.enum(["transport", "delivery", "installation", "activation", "other"]),
        files: z
          .array(
            z.object({
              contentBase64: z.string().min(1).max(MAX_EVIDENCE_BASE64_LENGTH),
              contentType: z.string().trim().min(1).max(200),
              fileName: z.string().trim().min(1).max(250),
            }).strict(),
          )
          .min(1)
          .max(MAX_EVIDENCE_FILE_COUNT),
        note: z.string().trim().max(1000).optional(),
      },
    },
    runTool(async (input) => {
      const body = buildApplicationEvidenceFormData(input);
      return backend.request("/api/admin/evidence", {
        body,
        method: "POST",
        timeoutMs: 120_000,
      });
    }),
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

  return server;
}

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
