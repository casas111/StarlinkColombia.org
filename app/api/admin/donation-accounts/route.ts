import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { donationAccountAssignments, donationAccounts } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";

const allowedTypes=new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const MAX_FILE_SIZE=20*1024*1024;
async function bucket(){const {env}=await import("cloudflare:workers");return (env as unknown as {BUCKET:R2Bucket}).BUCKET}

export async function GET(){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const db=await getDb();
  const [accounts,assignments]=await Promise.all([
    db.select().from(donationAccounts).orderBy(asc(donationAccounts.name)),
    db.select().from(donationAccountAssignments),
  ]);
  return Response.json({accounts,assignments});
}

export async function POST(request:Request){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const form=await request.formData(),name=String(form.get("name")||"").trim().slice(0,250),accountReference=String(form.get("accountReference")||"").trim().slice(0,250),notes=String(form.get("notes")||"").trim().slice(0,1500),file=form.get("contract");
  if(!name)return Response.json({error:"El nombre del Donation Account es obligatorio."},{status:400});
  if(!(file instanceof File)||!file.size)return Response.json({error:"Debes adjuntar el contrato firmado."},{status:400});
  if(file.size>MAX_FILE_SIZE)return Response.json({error:"El contrato supera 20 MB."},{status:413});
  if(!allowedTypes.has(file.type))return Response.json({error:"El contrato debe ser PDF, DOC o DOCX."},{status:415});
  const safeName=file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-140)||"contrato";
  const objectKey=`donation-accounts/${crypto.randomUUID()}-${safeName}`;
  await (await bucket()).put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{originalName:file.name,uploadedBy:admin.email}});
  try{
    const db=await getDb(),now=new Date().toISOString();
    const [saved]=await db.insert(donationAccounts).values({name,accountReference,notes,status:"active",contractFileName:file.name.slice(0,250),contractContentType:file.type,contractSizeBytes:file.size,contractObjectKey:objectKey,createdBy:admin.email,createdAt:now,updatedAt:now}).returning();
    return Response.json({ok:true,account:saved},{status:201});
  }catch(error){await (await bucket()).delete(objectKey);throw error}
}

export async function PATCH(request:Request){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const body=await request.json() as {entityType?:string;entityId?:number;donationAccountId?:number|null};
  if(!["application","allocation"].includes(body.entityType||"")||!Number.isInteger(body.entityId)||Number(body.entityId)<=0)return Response.json({error:"Invalid assignment"},{status:400});
  const db=await getDb(),entityType=body.entityType!,entityId=Number(body.entityId),accountId=Number(body.donationAccountId||0);
  if(!accountId){
    await db.delete(donationAccountAssignments).where(and(eq(donationAccountAssignments.entityType,entityType),eq(donationAccountAssignments.entityId,entityId)));
    return Response.json({ok:true,assignment:null});
  }
  const [account]=await db.select().from(donationAccounts).where(eq(donationAccounts.id,accountId)).limit(1);
  if(!account||account.status!=="active")return Response.json({error:"Donation Account not available"},{status:400});
  const now=new Date().toISOString();
  const {env}=await import("cloudflare:workers");
  await env.DB.prepare("INSERT INTO donation_account_assignments (entity_type, entity_id, donation_account_id, assigned_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entity_type, entity_id) DO UPDATE SET donation_account_id = excluded.donation_account_id, assigned_by = excluded.assigned_by, updated_at = excluded.updated_at").bind(entityType,entityId,accountId,admin.email,now).run();
  return Response.json({ok:true,assignment:{entityType,entityId,donationAccountId:accountId,assignedBy:admin.email,updatedAt:now}});
}
