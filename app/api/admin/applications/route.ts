import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { activities, admins, applications, inventoryItems } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";
import { recordMcpAudit } from "../../../../lib/mcp-audit";

const allowed = new Set(["new","review","prioritized","approved","delivery","active","recycle","declined"]);
export async function GET(request:Request) {
  const admin = await getAuthorizedAdmin(request,"data:read"); if (!admin) return Response.json({ error:"Unauthorized" },{status:403});
  const rows = await (await getDb()).select().from(applications).orderBy(desc(applications.aiPriorityScore),desc(applications.createdAt));
  return Response.json({ applications: rows, currentAdmin: { displayName:admin.displayName,email:admin.email,fullName:admin.fullName } });
}
export async function PATCH(request:Request) {
  const admin = await getAuthorizedAdmin(request,"data:write"); if (!admin) return Response.json({ error:"Unauthorized" },{status:403});
  const body = await request.json() as { id?:number; status?:string; notes?:string; updates?:Record<string,unknown>; assigneeEmail?:string };
  const assigning=Object.prototype.hasOwnProperty.call(body,"assigneeEmail");
  const hasChanges=Boolean(body.status||typeof body.notes==="string"||assigning||Object.keys(body.updates||{}).length);
  if (!body.id || !hasChanges || (body.status&&!allowed.has(body.status))) return Response.json({error:"Invalid update"},{status:400});
  const db=await getDb(); const update:Record<string,unknown>={updatedAt:new Date().toISOString()};
  const [current]=await db.select().from(applications).where(eq(applications.id,body.id)).limit(1);
  if(!current)return Response.json({error:"Not found"},{status:404});
  if(body.status)update.status=body.status;
  const textFields=["organization","organizationType","department","city","location","useCase","impact","responsibleName","responsibleRole","phone","email","powerAvailable","safeInstallation","continuityPlan","deliveryTiming","requestedDeliveryAt"];
  for(const key of textFields)if(body.updates&&key in body.updates)update[key]=String(body.updates[key]??"").slice(0,key==="useCase"||key==="impact"?4000:500);
  if(body.updates&&"units" in body.updates)update.units=Math.max(1,Math.min(100,Number(body.updates.units)||1));
  if (typeof body.notes==="string") update.adminNotes=body.notes.slice(0,2000);
  if (Object.prototype.hasOwnProperty.call(body,"assigneeEmail")) {
    const email=String(body.assigneeEmail||"").trim().toLowerCase();
    if(!email){update.sponsorEmail=null;update.sponsorName=null}
    else{const [assignee]=await db.select().from(admins).where(eq(admins.email,email)).limit(1);if(!assignee||assignee.status!=="active")return Response.json({error:"Admin not available"},{status:400});update.sponsorEmail=assignee.email;update.sponsorName=assignee.name||assignee.email}
  } else if (body.status==="prioritized"&&!current.sponsorEmail) { update.sponsorEmail=admin.email; update.sponsorName=admin.displayName; }
  await db.update(applications).set(update).where(eq(applications.id,body.id));
  const nextStatus=String(update.status||current.status),now=String(update.updatedAt);
  const inventoryWhere=and(eq(inventoryItems.sourceEntityType,"application"),eq(inventoryItems.sourceEntityId,body.id));
  if(nextStatus==="recycle"){
    const [existing]=await db.select().from(inventoryItems).where(inventoryWhere).limit(1);
    const name=String(update.organization||current.organization),units=Number(update.units||current.units);
    if(existing)await db.update(inventoryItems).set({name,units,status:existing.status==="archived"?"active":existing.status,availabilityStatus:existing.status==="archived"?"pending":existing.availabilityStatus,updatedBy:admin.email,updatedAt:now}).where(eq(inventoryItems.id,existing.id));
    else await db.insert(inventoryItems).values({sourceType:"recycle",sourceEntityType:"application",sourceEntityId:body.id,name,units,location:String(update.location||current.location),handlerEmail:String(update.sponsorEmail||current.sponsorEmail||admin.email),handlerName:String(update.sponsorName||current.sponsorName||admin.displayName),availabilityStatus:"pending",notes:"Generado al mover la solicitud a Recycle.",status:"active",createdBy:admin.email,updatedBy:admin.email,createdAt:now,updatedAt:now});
  }else if(current.status==="recycle"&&body.status){
    await db.update(inventoryItems).set({status:"archived",updatedBy:admin.email,updatedAt:now}).where(inventoryWhere);
  }
  await db.insert(activities).values({applicationId:body.id,actorEmail:admin.email,action:assigning?"admin_assigned":body.status?"status_changed":"card_edited",detail:assigning?(body.assigneeEmail||"unassigned"):body.status||Object.keys(body.updates||{}).join(",")});
  await recordMcpAudit(admin,{action:"application_updated",targetType:"application",targetId:body.id,detail:{status:body.status,fields:Object.keys(body.updates||{}),assignmentChanged:assigning}});
  return Response.json({ok:true});
}
