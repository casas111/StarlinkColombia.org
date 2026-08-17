import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { adminInvites, admins } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";

export async function GET(){const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});return Response.json({admins:await (await getDb()).select().from(admins).orderBy(desc(admins.createdAt))});}
export async function POST(request:Request){const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});const db=await getDb();await db.update(adminInvites).set({active:0});const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");await db.insert(adminInvites).values({token,invitedBy:admin.email,active:1});const origin=new URL(request.url).origin;return Response.json({ok:true,url:`${origin}/admin/join?token=${token}`});}
