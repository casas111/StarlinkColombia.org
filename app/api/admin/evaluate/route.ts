import { eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { applications } from "../../../../db/schema";
import { getAuthorizedAdmin } from "../../../../lib/admin";
import { evaluatePriority } from "../../../../lib/priority-evaluator";
export async function POST(request:Request){
 const admin=await getAuthorizedAdmin();if(!admin)return Response.json({error:"Unauthorized"},{status:403});
 const body=await request.json().catch(()=>({})) as {id?:number;all?:boolean};
 const db=await getDb();
 const rows=body.id?await db.select().from(applications).where(eq(applications.id,body.id)).limit(1):body.all?await db.select().from(applications).where(isNull(applications.aiPriorityScore)).limit(50):[];
 if(rows.length===0)return Response.json({ok:true,evaluated:0,requested:0,failed:0,message:"No hay solicitudes pendientes de evaluación."});
 let evaluated=0;const failures:Array<{reference:string;error:string}>=[];
 for(const app of rows){
  try{const result=await evaluatePriority(app);if(result.ok)evaluated++;else failures.push({reference:app.reference,error:result.error});}
  catch{failures.push({reference:app.reference,error:"unexpected_error"});}
 }
 if(failures.length)return Response.json({ok:false,evaluated,requested:rows.length,failed:failures.length,errors:failures},{status:502});
 return Response.json({ok:true,evaluated,requested:rows.length,failed:0,message:`${evaluated} solicitudes evaluadas correctamente.`});
}
