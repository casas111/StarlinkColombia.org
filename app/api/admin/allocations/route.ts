import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { admins, allocationOverrides, allocations, inventoryItems } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";
import { recordMcpAudit } from "../../../../lib/mcp-audit";

const editable = ["institution", "type", "kit", "city", "units", "terminal", "logistics", "activated", "agreement", "contact", "terminalProvider", "finalDestination", "receivedName", "receivedId", "receivedPhone", "portalStage"] as const;
const allowedStages = new Set(["new", "review", "prioritized", "approved", "delivery", "active", "recycle", "declined"]);

export async function GET(request: Request) {
  const admin = await getAuthorizedAdmin(request, "data:read");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const db = await getDb();
  const [rows, overrides] = await Promise.all([
    db.select().from(allocations).orderBy(asc(allocations.sourceRow)),
    db.select().from(allocationOverrides),
  ]);
  const byRow = new Map(overrides.map((override) => [override.sourceRow, override]));
  return Response.json({
    allocations: rows.map((row) => {
      const override = byRow.get(row.sourceRow);
      if (!override) return row;
      try { return { ...row, ...JSON.parse(override.payload), portalEditedAt: override.updatedAt }; }
      catch { return row; }
    }),
  });
}

export async function PATCH(request: Request) {
  const admin = await getAuthorizedAdmin(request, "data:write");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json() as { sourceRow?: number; updates?: Record<string, unknown>; assigneeEmail?: string };
  const assigning = Object.prototype.hasOwnProperty.call(body, "assigneeEmail");
  if (!Number.isInteger(body.sourceRow) || (!body.updates && !assigning)) return Response.json({ error: "Invalid update" }, { status: 400 });

  const clean: Record<string, string | number> = {};
  for (const key of editable) {
    if (!body.updates || !(key in body.updates)) continue;
    if (key === "units") clean[key] = Math.max(1, Math.min(100, Number(body.updates[key]) || 1));
    else if (key === "portalStage") {
      const stage = String(body.updates[key] ?? "");
      if (!allowedStages.has(stage)) return Response.json({ error: "Invalid stage" }, { status: 400 });
      clean[key] = stage;
    } else clean[key] = String(body.updates[key] ?? "").slice(0, key === "kit" || key === "finalDestination" ? 4000 : 500);
  }

  const db = await getDb();
  if (assigning) {
    const email = String(body.assigneeEmail || "").trim().toLowerCase();
    if (!email) { clean.adminEmail = ""; clean.adminName = ""; }
    else {
      const [assignee] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
      if (!assignee || assignee.status !== "active") return Response.json({ error: "Admin not available" }, { status: 400 });
      clean.adminEmail = assignee.email;
      clean.adminName = assignee.name || assignee.email;
    }
  }
  if (!Object.keys(clean).length) return Response.json({ error: "No changes" }, { status: 400 });

  const [base] = await db.select().from(allocations).where(eq(allocations.sourceRow, body.sourceRow!)).limit(1);
  if (!base) return Response.json({ error: "Allocation not found" }, { status: 404 });
  const [existingOverride] = await db.select().from(allocationOverrides).where(eq(allocationOverrides.sourceRow, body.sourceRow!)).limit(1);
  let previous: Record<string, unknown> = {};
  if (existingOverride) { try { previous = JSON.parse(existingOverride.payload); } catch { previous = {}; } }
  const next = { ...base, ...previous, ...clean } as typeof base & { portalStage?: string; adminEmail?: string; adminName?: string };
  const now = new Date().toISOString();
  await db.insert(allocationOverrides).values({ sourceRow: body.sourceRow!, payload: JSON.stringify({ ...previous, ...clean }), editedBy: admin.email, updatedAt: now }).onConflictDoUpdate({ target: allocationOverrides.sourceRow, set: { payload: JSON.stringify({ ...previous, ...clean }), editedBy: admin.email, updatedAt: now } });

  const inventoryWhere = and(eq(inventoryItems.sourceEntityType, "allocation"), eq(inventoryItems.sourceEntityId, base.id));
  if (next.portalStage === "recycle") {
    const [existingInventory] = await db.select().from(inventoryItems).where(inventoryWhere).limit(1);
    const name = String(next.institution), units = Number(next.units);
    if (existingInventory) {
      await db.update(inventoryItems).set({ name, units, status: existingInventory.status === "archived" ? "active" : existingInventory.status, availabilityStatus: existingInventory.status === "archived" ? "pending" : existingInventory.availabilityStatus, handlerEmail: assigning ? String(next.adminEmail || admin.email) : existingInventory.handlerEmail, handlerName: assigning ? String(next.adminName || admin.displayName) : existingInventory.handlerName, updatedBy: admin.email, updatedAt: now }).where(eq(inventoryItems.id, existingInventory.id));
    } else {
      await db.insert(inventoryItems).values({ sourceType: "recycle", sourceEntityType: "allocation", sourceEntityId: base.id, name, units, location: String(next.city || next.finalDestination || "Ubicación por confirmar"), handlerEmail: String(next.adminEmail || admin.email), handlerName: String(next.adminName || admin.displayName), availabilityStatus: "pending", notes: "Generado al mover la operación a Recycle.", status: "active", createdBy: admin.email, updatedBy: admin.email, createdAt: now, updatedAt: now });
    }
  } else if (previous.portalStage === "recycle" && clean.portalStage) {
    await db.update(inventoryItems).set({ status: "archived", updatedBy: admin.email, updatedAt: now }).where(inventoryWhere);
  }

  await recordMcpAudit(admin, { action: "allocation_updated", targetType: "allocation", targetId: body.sourceRow!, detail: { fields: Object.keys(clean) } });
  return Response.json({ ok: true, updatedAt: now });
}
