import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { operationalEvidence } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";

const entityTypes=new Set(["application","allocation"]);
const categories=new Set(["transport","delivery","installation","activation","other"]);
const allowedTypes=new Set(["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/csv","text/plain"]);
const MAX_FILE_SIZE=12*1024*1024;
function validEntity(type:string,id:number){return entityTypes.has(type)&&Number.isInteger(id)&&id>0}
async function bucket(){const {env}=await import("cloudflare:workers");return (env as unknown as {BUCKET:R2Bucket}).BUCKET}

export async function GET(request:Request){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const url=new URL(request.url),entityType=url.searchParams.get("entityType")||"",entityId=Number(url.searchParams.get("entityId"));
  if(!validEntity(entityType,entityId))return Response.json({error:"Invalid entity"},{status:400});
  const db=await getDb();
  const evidence=await db.select({id:operationalEvidence.id,category:operationalEvidence.category,note:operationalEvidence.note,fileName:operationalEvidence.fileName,contentType:operationalEvidence.contentType,sizeBytes:operationalEvidence.sizeBytes,uploadedBy:operationalEvidence.uploadedBy,createdAt:operationalEvidence.createdAt}).from(operationalEvidence).where(and(eq(operationalEvidence.entityType,entityType),eq(operationalEvidence.entityId,entityId))).orderBy(desc(operationalEvidence.createdAt));
  return Response.json({evidence});
}

export async function POST(request:Request){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const form=await request.formData(),entityType=String(form.get("entityType")||""),entityId=Number(form.get("entityId")),category=String(form.get("category")||"other"),note=String(form.get("note")||"").trim().slice(0,1000),file=form.get("file");
  if(!validEntity(entityType,entityId)||!categories.has(category))return Response.json({error:"Invalid evidence data"},{status:400});
  if(!(file instanceof File)||!file.size)return Response.json({error:"File required"},{status:400});
  if(file.size>MAX_FILE_SIZE)return Response.json({error:"El archivo supera 12 MB"},{status:413});
  if(!file.type.startsWith("image/")&&!allowedTypes.has(file.type))return Response.json({error:"Formato no permitido"},{status:415});
  const safeName=file.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"evidencia";
  const objectKey=`evidence/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;
  await (await bucket()).put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{originalName:file.name,uploadedBy:admin.email}});
  const db=await getDb();
  const [saved]=await db.insert(operationalEvidence).values({entityType,entityId,category,note,fileName:file.name.slice(0,250),contentType:file.type||"application/octet-stream",sizeBytes:file.size,objectKey,uploadedBy:admin.email}).returning({id:operationalEvidence.id});
  return Response.json({ok:true,id:saved.id},{status:201});
}
