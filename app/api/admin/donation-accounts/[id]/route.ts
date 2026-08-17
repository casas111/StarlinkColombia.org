import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { donationAccounts } from "../../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../../lib/admin";

async function bucket(){const {env}=await import("cloudflare:workers");return (env as unknown as {BUCKET:R2Bucket}).BUCKET}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
  const {id}=await params,db=await getDb();const [row]=await db.select().from(donationAccounts).where(eq(donationAccounts.id,Number(id))).limit(1);
  if(!row)return Response.json({error:"Not found"},{status:404});
  const object=await (await bucket()).get(row.contractObjectKey);if(!object)return Response.json({error:"Contract not found"},{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set("content-type",row.contractContentType);headers.set("content-length",String(row.contractSizeBytes));headers.set("cache-control","private, max-age=300");headers.set("content-disposition",`${row.contractContentType==="application/pdf"?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(row.contractFileName)}`);
  return new Response(object.body,{headers});
}
