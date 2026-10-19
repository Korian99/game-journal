
import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";
import {deliverPush,type Delivery} from "./delivery.ts";
import {releaseNotificationDue} from "./notification-release.ts";
const base=Deno.env.get("SUPABASE_URL")!;
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return Response.json({error:"Método no permitido"},{status:405});
 const db=createClient(base,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 try {
  const {data:initial,error:configError}=await db.rpc("worker_config");if(configError)throw configError;
  let config=initial,owner:string|null=null;
  if(!req.headers.get("x-cron-secret")||req.headers.get("x-cron-secret")!==config.game_journal_cron){
   const jwt=req.headers.get("authorization")?.replace(/^Bearer /i,"");
   const {data:{user}}=await db.auth.getUser(jwt??"");
   if(!user)return Response.json({error:"No autorizado"},{status:401});
   const {data:member}=await db.from("members").select("active").eq("id",user.id).eq("active",true).single();
   if(!member)return Response.json({error:"Sin acceso"},{status:403});owner=user.id;
  }
  if(!config.game_journal_vapid_public||!config.game_journal_vapid_private){
   const keys=webpush.generateVAPIDKeys();
   const {data:ready,error}=await db.rpc("configure_push_keys",{public_key:keys.publicKey,private_key:keys.privateKey});
   if(error)throw error;config=ready;
  }
  const {data:candidates,error:releaseError}=await db.rpc("notification_release_candidates",{member_id:owner});
  if(releaseError)throw releaseError;
  const due=(candidates??[]).filter((record:any)=>releaseNotificationDue(record)).map((record:any)=>record.id);
  let releases=0;
  for(let offset=0;offset<due.length;offset+=500){
   const {data,error}=await db.rpc("enqueue_due_releases",{game_ids:due.slice(offset,offset+500)});
   if(error)throw error;releases+=data??0;
  }
  webpush.setVapidDetails("https://github.com/Korian99/game-journal",config.game_journal_vapid_public,config.game_journal_vapid_private);
  const {data:deliveries,error:claimError}=await db.rpc("claim_notification_deliveries",{member_id:owner});
  if(claimError)throw claimError;
  const totals={sent:0,retry:0,expired:0};
  const sentEventIds:string[]=[];
  for(let offset=0;offset<deliveries.length;offset+=4){
   await Promise.all(deliveries.slice(offset,offset+4).map(async(delivery:Delivery)=>{
    const result=await deliverPush(delivery,{
     send:(subscription,payload)=>webpush.sendNotification(subscription,payload,{TTL:86400,timeout:8000}),
     finish:async(d,result)=>{
      const {error}=await db.rpc("finish_notification_delivery",{event:d.event_id,device:d.subscription_id,token:d.lease_token,result});
      if(error)throw error;
     }
    });
    totals[result]++;
    if(result==="sent")sentEventIds.push(delivery.event_id);
   }));
  }
  return Response.json({releases,...totals,sentEventIds,claimed:deliveries.length});
 } catch {
  // Never return push endpoints, keys, subscriptions or Vault configuration in errors.
  return Response.json({error:"No se pudieron procesar las notificaciones."},{status:500});
 }
});
