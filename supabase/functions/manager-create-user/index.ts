import { createClient } from 'npm:@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Méthode non autorisée'},405)
 try{
  const authHeader=req.headers.get('Authorization')||''
  if(!authHeader.startsWith('Bearer '))return reply({error:'Non authentifié'},401)
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const callerClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}})
  const {data:userData,error:userErr}=await callerClient.auth.getUser(authHeader.slice(7))
  if(userErr||!userData.user)return reply({error:'Session invalide'},401)
  const admin=createClient(url,service)
  const {data:caller}=await admin.from('profiles').select('id,display_name,role,active').eq('id',userData.user.id).single()
  if(!caller||caller.role!=='manager'||!caller.active)return reply({error:'Accès Manager requis'},403)

  const body=await req.json(),email=String(body.email||'').trim().toLowerCase(),displayName=String(body.display_name||'').trim(),password=String(body.password||'')
  const role=body.role==='manager'?'manager':'technician'
  if(!displayName||!email.includes('@')||password.length<10)return reply({error:'Nom, email et mot de passe valides requis'},400)
  const {data:created,error:createErr}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:displayName}})
  if(createErr)throw createErr
  const {error:updateErr}=await admin.from('profiles').update({display_name:displayName,role,active:true,force_password_change:true}).eq('id',created.user.id)
  if(updateErr)throw updateErr
  await admin.from('audit_events').insert({actor_id:caller.id,actor_name:caller.display_name,action:'user_created',target_type:'profile',target_id:created.user.id,details:{email,display_name:displayName,role}})
  return reply({user:{id:created.user.id,email,display_name:displayName,role}})
 }catch(e){return reply({error:e?.message||'Erreur serveur'},400)}
})
