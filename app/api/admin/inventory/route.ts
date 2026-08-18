import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { admins, inventoryItems } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";
import { validateInventoryInput } from "../../../../lib/inventory.mjs";
import { recordMcpAudit } from "../../../../lib/mcp-audit";

type InventoryValues = {
  sourceType: string;
  name: string;
  units: number;
  location: string;
  handlerEmail: string;
  availabilityStatus: string;
  availableAt: string | null;
  notes: string;
  status: string;
};

export async function GET(request: Request) {
  const admin = await getAuthorizedAdmin(request, "data:read");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const items = await (await getDb()).select().from(inventoryItems).orderBy(desc(inventoryItems.updatedAt));
  return Response.json({ inventory: items });
}

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin(request, "data:write");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const validation = validateInventoryInput(body);
  if ("error" in validation) return Response.json({ error: validation.error }, { status: validation.status });
  const data = validation.data as InventoryValues;
  const db = await getDb();
  const [handler] = await db.select().from(admins).where(eq(admins.email, data.handlerEmail)).limit(1);
  if (!handler || handler.status !== "active") return Response.json({ error: "Administrador no disponible" }, { status: 400 });
  const now = new Date().toISOString();
  const [created] = await db.insert(inventoryItems).values({
    ...data,
    handlerName: handler.name || handler.email,
    status: "active",
    createdBy: admin.email,
    updatedBy: admin.email,
    createdAt: now,
    updatedAt: now,
  }).returning();
  await recordMcpAudit(admin, { action: "inventory_created", targetType: "inventory", targetId: created.id, detail: { sourceType: created.sourceType, units: created.units } });
  return Response.json({ ok: true, item: created }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await getAuthorizedAdmin(request, "data:write");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const body = await request.json().catch(() => null) as ({ id?: number } & Record<string, unknown>) | null;
  if (!body || !Number.isInteger(body.id) || Number(body.id) <= 0) return Response.json({ error: "Inventario inválido" }, { status: 400 });
  const updates = Object.fromEntries(Object.entries(body).filter(([key]) => key !== "id" && ["name", "units", "location", "handlerEmail", "availabilityStatus", "availableAt", "notes", "status"].includes(key)));
  if (!Object.keys(updates).length) return Response.json({ error: "No hay cambios" }, { status: 400 });
  const validation = validateInventoryInput(updates, { partial: true });
  if ("error" in validation) return Response.json({ error: validation.error }, { status: validation.status });
  const data = validation.data as Partial<InventoryValues>;
  const db = await getDb();
  const [current] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, body.id!)).limit(1);
  if (!current) return Response.json({ error: "Inventario no encontrado" }, { status: 404 });
  const next = { ...current, ...data };
  if (next.availabilityStatus === "scheduled" && !next.availableAt) return Response.json({ error: "Indica cuándo estará disponible." }, { status: 400 });
  let handlerName = current.handlerName;
  if (data.handlerEmail) {
    const [handler] = await db.select().from(admins).where(eq(admins.email, data.handlerEmail)).limit(1);
    if (!handler || handler.status !== "active") return Response.json({ error: "Administrador no disponible" }, { status: 400 });
    handlerName = handler.name || handler.email;
  }
  const changed = { ...data, handlerName, updatedBy: admin.email, updatedAt: new Date().toISOString() };
  const [saved] = await db.update(inventoryItems).set(changed).where(eq(inventoryItems.id, body.id!)).returning();
  await recordMcpAudit(admin, { action: "inventory_updated", targetType: "inventory", targetId: body.id!, detail: { fields: Object.keys(data) } });
  return Response.json({ ok: true, item: saved });
}
