import {createClient} from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";
import {parseStoreUrl,parseSteam,parseNintendo} from "./domain.ts";
const base=Deno.env.get("SUPABASE_URL")!;
async function safeFetch(url:string,originalHost:string){
 for(let redirect=0;redirect<4;redirect++){
 const u=new URL(url);if(u.protocol!=="https:"||u.hostname!==originalHost||u.port||u.username||u.password)throw Error("Redirección de tienda rechazada");
 const response=await fetch(url,{redirect:"manual",headers:{"User-Agent":"GameJournal/1.0"},signal:AbortSignal.timeout(12000)});
 if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get("location")??"",url).href;continue;}
 if(!response.ok)throw Error("Tienda respondió "+response.status);return response;
 }throw Error("Demasiadas redirecciones");
}
Deno.serve(async(req:Request)=>{
 const db=createClient(base,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 try{
 const {data:initialConfig,error:configError}=await db.rpc("worker_config");if(configError)throw configError;let config=initialConfig;
 const cronToken=req.headers.get("x-cron-secret");let owner:string|null=null;
 if(!cronToken||cronToken!==config.game_journal_cron){
 const jwt=req.headers.get("authorization")?.replace(/^Bearer /i,"");const {data:{user}}=await db.auth.getUser(jwt??"");
 if(!user)return Response.json({error:"No autorizado"},{status:401});
 const {data:member}=await db.from("members").select("active").eq("id",user.id).eq("active",true).single();if(!member)return Response.json({error:"Sin acceso"},{status:403});owner=user.id;
 }
 if(!config.game_journal_vapid_public||!config.game_journal_vapid_private){const keys=webpush.generateVAPIDKeys();const {data:ready,error:keyError}=await db.rpc("configure_push_keys",{public_key:keys.publicKey,private_key:keys.privateKey});if(keyError)throw keyError;config=ready;}
 const {data:offers,error}=await db.rpc("claim_offers",{member_id:owner});if(error)throw error;
 let failed=0;const cache=new Map();
 const {data:run}=await db.from("refresh_runs").insert({}).select("id").single();
 async function process(offer:any){
 try{
 const target=parseStoreUrl(offer.url);const key=offer.store+":"+offer.product+":"+offer.region;
 let quote=cache.get(key);if(!quote){const {data:cached}=await db.rpc("get_price_cache",{cache_key:key});quote=cached;}
 if(!quote){
 let last:unknown;
 for(let attempt=0;attempt<3;attempt++){try{
 if(target.store==="steam"){const response=await safeFetch("https://store.steampowered.com/api/appdetails?appids="+target.product+"&cc="+offer.region.toLowerCase()+"&l=es","store.steampowered.com");const json=await response.json();quote=parseSteam(json[target.product]);}
 else{const response=await safeFetch(target.url,"www.nintendo.com");const text=await response.text();if(text.length>8_000_000)throw Error("Página demasiado grande");quote=parseNintendo(text,target.url);}
 break;
 }catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,(attempt+1)*700));}}
 if(!quote)throw last??Error("Consulta fallida");
 await db.rpc("set_price_cache",{cache_key:key,quote});
 }
 cache.set(key,quote);if(quote.price===null)failed++;
 const {error:saveError}=await db.rpc("record_quote",{offer_id:offer.id,quote,expected:offer.checked_at});if(saveError)throw saveError;
 }catch(e){failed++;await db.from("offers").update({error:String((e as Error).message??e).slice(0,400),checked_at:new Date().toISOString(),lease_until:null}).eq("id",offer.id);}
 }
 for(let i=0;i<offers.length;i+=2)await Promise.all(offers.slice(i,i+2).map(process));
 if(run)await db.from("refresh_runs").update({finished_at:new Date().toISOString(),processed:offers.length,failed}).eq("id",run.id);
 if(offers.length===8){const next=fetch(base+"/functions/v1/price-worker",{method:"POST",headers:{"Content-Type":"application/json",...(owner?{Authorization:req.headers.get("authorization")!}:{"x-cron-secret":cronToken!})},body:"{}"});(globalThis as any).EdgeRuntime?.waitUntil(next);}
 return Response.json({processed:offers.length,failed,continued:offers.length===8});
 }catch(e){return Response.json({error:"Actualización no completada: "+String((e as Error).message??e)},{status:500});}
});
