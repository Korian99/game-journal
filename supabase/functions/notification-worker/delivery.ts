
export type Delivery = {event_id:string;subscription_id:string;lease_token:string;subscription:any;title:string;body:string;url:string};
export function allowedPushEndpoint(value:string):boolean {
 try {
  const url=new URL(value);
  return url.protocol==="https:" && !url.port && !url.username && !url.password &&
    ["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com"].includes(url.hostname);
 } catch {return false;}
}
export async function deliverPush(delivery:Delivery, io:{
 send:(subscription:any,payload:string)=>Promise<unknown>;
 finish:(delivery:Delivery,result:"sent"|"retry"|"expired")=>Promise<void>
}):Promise<"sent"|"retry"|"expired"> {
 let result:"sent"|"retry"|"expired"="expired";
 if (allowedPushEndpoint(delivery.subscription?.endpoint)) {
  try {
   await io.send(delivery.subscription,JSON.stringify({title:delivery.title,body:delivery.body,tag:delivery.event_id,url:delivery.url}));
   result="sent";
  } catch (e) {result=[404,410].includes(Number((e as {statusCode?:number}).statusCode))?"expired":"retry";}
 }
 await io.finish(delivery,result);
 return result;
}
