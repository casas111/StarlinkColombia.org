import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { operationalEvidence } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";
import { safeEvidenceFileName, validateEvidenceFiles } from "../../../../lib/evidence-upload.mjs";

const entityTypes=new Set(["application","allocation"]);
const categories=new Set(["transport","delivery","installation","activation","other"]);
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
  const form=await request.formData(),entityType=String(form.get("entityType")||""),entityId=Number(form.get("entityId")),category=String(form.get("category")||"other"),note=String(form.get("note")||"").trim().slice(0,1000);
  if(!validEntity(entityType,entityId)||!categories.has(category))return Response.json({error:"Invalid evidence data"},{status:400});
  const validation=validateEvidenceFiles([...form.getAll("files"),...form.getAll("file")]);
  if("error" in validation)return Response.json({error:validation.error},{status:validation.status});
  const prepared=validation.files.map(file=>({file,objectKey:`evidence/${entityType}/${entityId}/${crypto.randomUUID()}-${safeEvidenceFileName(file.name)}`}));
  const storage=await bucket();
  const uploads=await Promise.allSettled(prepared.map(({file,objectKey})=>storage.put(objectKey,file.stream(),{httpMetadata:{contentType:file.type||"application/octet-stream"},customMetadata:{originalName:file.name,uploadedBy:admin.email}})));
  if(uploads.some(result=>result.status==="rejected")){
    await Promise.allSettled(prepared.map(({objectKey})=>storage.delete(objectKey)));
    return Response.json({error:"No fue posible guardar todos los archivos. Intenta de nuevo."},{status:502});
  }
  const db=await getDb();
  try{
    const saved=await db.insert(operationalEvidence).values(prepared.map(({file,objectKey})=>({entityType,entityId,category,note,fileName:file.name.slice(0,250),contentType:file.type||"application/octet-stream",sizeBytes:file.size,objectKey,uploadedBy:admin.email}))).returning({id:operationalEvidence.id});
    return Response.json({ok:true,count:saved.length,ids:saved.map(item=>item.id)},{status:201});
  }catch(error){
    await Promise.allSettled(prepared.map(({objectKey})=>storage.delete(objectKey)));
    console.error("Evidence metadata insert failed",error);
    return Response.json({error:"No fue posible registrar los archivos. Intenta de nuevo."},{status:500});
  }
}
