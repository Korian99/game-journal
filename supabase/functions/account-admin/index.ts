import {createClient} from "npm:@supabase/supabase-js@2.118.0";
Deno.serve(async(req:Request)=>{
 try{
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
 const body=await req.json();const email=String(body.email??"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:"Correo inválido"},{status:400});
 const origin=new URL(body.origin);if(origin.protocol!=="https:"&&!(origin.protocol==="http:"&&["localhost","127.0.0.1"].includes(origin.hostname)))throw Error("URL de la aplicación inválida");
 const token=req.headers.get("x-setup-token");let bootstrap=false;
 if(token){const {data:config}=await db.rpc("worker_config");const {count}=await db.from("members").select("*",{count:"exact",head:true}).eq("role","admin");bootstrap=token===config?.game_journal_setup&&count===0;if(!bootstrap)return Response.json({error:"Configuración inicial no autorizada"},{status:403});}
 else{const jwt=req.headers.get("authorization")?.replace(/^Bearer /i,"");const {data:{user}}=await db.auth.getUser(jwt??"");if(!user)return Response.json({error:"No autorizado"},{status:401});const {data:member}=await db.from("members").select("role").eq("id",user.id).eq("active",true).single();if(member?.role!=="admin")return Response.json({error:"Solo administrador"},{status:403});}
 const {data:users,error:listError}=await db.auth.admin.listUsers({page:1,perPage:1000});if(listError)throw listError;const existing=users.users.find(u=>u.email?.toLowerCase()===email);
 const {data,error}=await db.auth.admin.generateLink({type:existing?"recovery":"invite",email});if(error)throw error;
 if(bootstrap){const {error:claimError}=await db.rpc("bootstrap_member",{token,user_id:data.user.id,email});if(claimError)throw claimError;}
 else{const {data:old}=await db.from("members").select("id").eq("id",data.user.id).single();if(!old){const {error}=await db.from("members").insert({id:data.user.id,display_name:email,role:"member"});if(error)throw error;}}
 return Response.json({link:origin.origin+"/auth/confirm?token_hash="+data.properties.hashed_token+"&type="+(existing?"recovery":"invite")},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return Response.json({error:String((e as Error).message??e)},{status:400});}
});
