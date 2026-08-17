import { getDb } from "../../../../db";
import { applications } from "../../../../db/schema";

export async function POST(request: Request) {
  const secret = request.headers.get("x-hermes-secret");
  const expected = process.env.HERMES_WEBHOOK_SECRET;
  if (!expected || secret !== expected) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const value = (key:string,max=1200) => typeof body[key] === "string" ? (body[key] as string).trim().slice(0,max) : "";
    const reference = `WA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    await (await getDb()).insert(applications).values({ reference, organization:value("organization",180), organizationType:value("organizationType",80)||"Otra", department:value("department",100), city:value("city",100), location:value("location",240), units:Math.max(1,Math.min(20,Number(body.units)||1)), useCase:value("useCase"), impact:value("impact",500), responsibleName:value("responsibleName",160), responsibleRole:value("responsibleRole",160)||"Responsable local", phone:value("phone",50), email:value("email",180)||"whatsapp@pendiente.local", powerAvailable:value("powerAvailable",30)||"to_confirm", safeInstallation:value("safeInstallation",30)||"to_confirm", continuityPlan:value("continuityPlan",30)||"support", source:"whatsapp" });
    return Response.json({ reference }, { status: 201 });
  } catch { return Response.json({ error: "Invalid payload" }, { status: 400 }); }
}
