import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { activities, applications, operationPromotions } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";
import { recordMcpAudit } from "../../../../lib/mcp-audit";

export async function POST(request:Request){
  const admin=await getAuthorizedAdmin(request,"operations:promote");if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const body=await request.json() as {id?:number;confirm?:boolean};if(!body.id)return Response.json({error:"Solicitud inválida"},{status:400});
  if(admin.authSource==="mcp"&&body.confirm!==true)return Response.json({error:"Explicit confirmation is required"},{status:400});
  const db=await getDb();const [app]=await db.select().from(applications).where(eq(applications.id,body.id)).limit(1);if(!app)return Response.json({error:"Solicitud no encontrada"},{status:404});
  if(app.operationStatus!=="not_promoted")return Response.json({ok:true,reference:app.reference,status:app.operationStatus,alreadyPromoted:true});
  const payload=JSON.stringify({reference:app.reference,organization:app.organization,organizationType:app.organizationType,department:app.department,city:app.city,location:app.location,units:app.units,useCase:app.useCase,responsibleName:app.responsibleName,phone:app.phone,email:app.email,deliveryTiming:app.deliveryTiming,requestedDeliveryAt:app.requestedDeliveryAt});
  await db.insert(operationPromotions).values({applicationId:app.id,reference:app.reference,payload,status:"pending",promotedBy:admin.email}).onConflictDoNothing();
  const now=new Date().toISOString();await db.update(applications).set({operationStatus:"pending",operationPromotedAt:now,status:"approved",updatedAt:now}).where(eq(applications.id,app.id));
  await db.insert(activities).values({applicationId:app.id,actorEmail:admin.email,action:"promoted_to_operation",detail:"Pendiente de sincronización con Google Sheets"});
  await recordMcpAudit(admin,{action:"application_promoted",targetType:"application",targetId:app.id,detail:{reference:app.reference}});
  return Response.json({ok:true,reference:app.reference,status:"pending"});
}
