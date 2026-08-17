import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { operationalEvidence } from "../../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../../lib/admin";

async function bucket(){const {env}=await import("cloudflare:workers");return (env as unknown as {BUCKET:R2Bucket}).BUCKET}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const {id}=await params,db=await getDb();const [row]=await db.select().from(operationalEvidence).where(eq(operationalEvidence.id,Number(id))).limit(1);
  if(!row)return Response.json({error:"Not found"},{status:404});
  const object=await (await bucket()).get(row.objectKey);if(!object)return Response.json({error:"File not found"},{status:404});
  const inline=row.contentType.startsWith("image/")||row.contentType==="application/pdf";
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set("content-type",row.contentType);headers.set("content-length",String(row.sizeBytes));headers.set("cache-control","private, max-age=300");headers.set("content-disposition",`${inline?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
  return new Response(object.body,{headers});
}

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const {id}=await params,db=await getDb();const [row]=await db.select().from(operationalEvidence).where(eq(operationalEvidence.id,Number(id))).limit(1);
  if(!row)return Response.json({error:"Not found"},{status:404});
  await (await bucket()).delete(row.objectKey);await db.delete(operationalEvidence).where(eq(operationalEvidence.id,row.id));
  return Response.json({ok:true});
}
