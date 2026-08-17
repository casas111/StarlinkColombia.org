import { getDb } from "../../../db";
import { applications } from "../../../db/schema";
import { evaluatePriority } from "../../../lib/priority-evaluator";

function clean(value: unknown, max = 1200) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const required = ["organization","organizationType","department","city","location","useCase","impact","responsibleName","responsibleRole","phone","email","powerAvailable","safeInstallation","continuityPlan","deliveryTiming"];
    if (required.some((key) => !clean(body[key]))) return Response.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    if (clean(body.useCase).length < 80) return Response.json({ error: "Describe el uso con mayor detalle" }, { status: 400 });
    const deliveryTiming=clean(body.deliveryTiming,20);if(!["asap","scheduled"].includes(deliveryTiming))return Response.json({error:"Fecha de entrega inválida"},{status:400});
    const requestedDeliveryAt=deliveryTiming==="scheduled"?clean(body.requestedDeliveryAt,40):"";if(deliveryTiming==="scheduled"&&!requestedDeliveryAt)return Response.json({error:"Selecciona fecha y hora de entrega"},{status:400});
    const reference = `CC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const db = await getDb();
    const [created]=await db.insert(applications).values({ reference, organization:clean(body.organization,180), organizationType:clean(body.organizationType,80), department:clean(body.department,100), city:clean(body.city,100), location:clean(body.location,240), units:Math.max(1,Math.min(20,Number(body.units)||1)), useCase:clean(body.useCase), impact:clean(body.impact,500), responsibleName:clean(body.responsibleName,160), responsibleRole:clean(body.responsibleRole,160), phone:clean(body.phone,50), email:clean(body.email,180).toLowerCase(), powerAvailable:clean(body.powerAvailable,30), safeInstallation:clean(body.safeInstallation,30), continuityPlan:clean(body.continuityPlan,30), deliveryTiming, requestedDeliveryAt:requestedDeliveryAt||null, source:clean(body.source,30)||"web" }).returning();
    try{await evaluatePriority(created)}catch{}
    return Response.json({ reference }, { status: 201 });
  } catch { return Response.json({ error: "No fue posible guardar la solicitud" }, { status: 500 }); }
}
