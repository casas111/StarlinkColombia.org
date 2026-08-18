import { GET as getAllocations, PATCH as patchAllocations } from "../admin/allocations/route";
import { GET as getApplications, PATCH as patchApplications } from "../admin/applications/route";
import { POST as postEvidence } from "../admin/evidence/route";
import { GET as getInventory, PATCH as patchInventory, POST as postInventory } from "../admin/inventory/route";
import { POST as promoteApplication } from "../admin/promote/route";
import { getAuthorizedAdmin } from "../../../lib/admin";
import { createBackendClient } from "../../../mcp/client.mjs";
import { createMcpHttpHandler } from "../../../mcp/http.mjs";

type RouteHandler = (request: Request) => Promise<Response>;

const adminRoutes = new Map<string, RouteHandler>([
  ["GET /api/admin/allocations", getAllocations],
  ["PATCH /api/admin/allocations", patchAllocations],
  ["GET /api/admin/applications", getApplications],
  ["PATCH /api/admin/applications", patchApplications],
  ["POST /api/admin/evidence", postEvidence],
  ["GET /api/admin/inventory", getInventory],
  ["PATCH /api/admin/inventory", patchInventory],
  ["POST /api/admin/inventory", postInventory],
  ["POST /api/admin/promote", promoteApplication],
]);

const handleRequest = createMcpHttpHandler({
  authorize: (request: Request) => getAuthorizedAdmin(request),
  createBackend: ({ request, token }: { request: Request; token: string }) =>
    createBackendClient({
      baseUrl: new URL("/", request.url).toString(),
      fetchImpl: dispatchAdminRequest,
      token,
    }),
});

export const POST = handleRequest;
export const OPTIONS = handleRequest;
export const GET = handleRequest;
export const DELETE = handleRequest;

async function dispatchAdminRequest(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init);
  const key = `${request.method} ${new URL(request.url).pathname}`;
  const handler = adminRoutes.get(key);
  if (!handler) return Response.json({ error: "Backend route not found" }, { status: 404 });
  return handler(request);
}
