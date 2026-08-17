import { getDb } from "../db";
import { allocations } from "../db/schema";

function stage(terminal:string,activated:string){const t=terminal.toLowerCase(),a=activated.toLowerCase();if(a==="online")return "active";if(t.includes("in transit")||t.includes("delivered"))return "delivery";if(t.includes("assigned"))return "approved";if(t.includes("not approved"))return "declined";if(t.includes("pendiente"))return "review";return "new";}

export async function syncStarlinkRows(rows:unknown[][]){
  if(rows.length<2)throw new Error("El archivo no contiene registros");
  const db=await getDb(); const now=new Date().toISOString(); let synced=0;
  for(let index=1;index<rows.length;index++){const r=rows[index];if(!r[0]?.trim())continue;const values={sourceRow:index+1,institution:r[0]?.trim()||"Sin institución",type:r[1]?.trim()||"",kit:r[2]?.trim()||"",city:r[3]?.trim()||"",units:Math.max(1,Number.parseInt(r[4]||"1",10)||1),terminal:r[5]?.trim()||"",logistics:r[6]?.trim()||"",activated:r[7]?.trim()||"",agreement:r[8]?.trim()||"",contact:r[9]?.trim()||"",terminalProvider:r[10]?.trim()||"",finalDestination:r[11]?.trim()||"",receivedName:r[12]?.trim()||"",receivedId:r[13]?.trim()||"",receivedPhone:r[14]?.trim()||"",stage:stage(r[5]||"",r[7]||""),sourceUpdatedAt:now};
    await db.insert(allocations).values(values).onConflictDoUpdate({target:allocations.sourceRow,set:values});synced++;
  }
  return {synced,sourceRows:rows.length-1,updatedAt:now};
}
