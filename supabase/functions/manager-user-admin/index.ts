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

  const body=await req.json(),operation=String(body.operation||''),userId=String(body.user_id||'')
  if(!userId)return reply({error:'Utilisateur cible requis'},400)
  const {data:targetProfile}=await admin.from('profiles').select('*').eq('id',userId).single()
  const {data:targetUser,error:targetErr}=await admin.auth.admin.getUserById(userId)
  if(targetErr||!targetUser.user)return reply({error:'Utilisateur introuvable'},404)
  let details:Record<string,unknown>={target_email:targetUser.user.email,target_name:targetProfile?.display_name}

  if(operation==='set_password'){
   const password=String(body.password||'')
   if(password.length<10)return reply({error:'10 caractères minimum'},400)
   const {error}=await admin.auth.admin.updateUserById(userId,{password});if(error)throw error
   await admin.from('profiles').update({force_password_change:body.force_change!==false}).eq('id',userId)
   details={...details,force_change:body.force_change!==false}
  }else if(operation==='send_reset'){
   if(!targetUser.user.email)return reply({error:'Email absent'},400)
   const publicClient=createClient(url,anon)
   const {error}=await publicClient.auth.resetPasswordForEmail(targetUser.user.email);if(error)throw error
  }else if(operation==='update_email'){
   const email=String(body.email||'').trim().toLowerCase()
   if(!email.includes('@'))return reply({error:'Email invalide'},400)
   const {error}=await admin.auth.admin.updateUserById(userId,{email});if(error)throw error
   await admin.from('profiles').update({email}).eq('id',userId);details={...details,new_email:email}
  }else if(operation==='delete_user'){
   if(userId===caller.id)return reply({error:'Tu ne peux pas supprimer ton propre compte'},400)
   if(targetProfile?.role==='manager'&&targetProfile.active){
    const {count}=await admin.from('profiles').select('*',{count:'exact',head:true}).eq('role','manager').eq('active',true)
    if((count||0)<=1)return reply({error:'Impossible de supprimer le dernier Manager actif'},400)
   }
   await admin.from('audit_events').insert({actor_id:caller.id,actor_name:caller.display_name,action:'user_deleted',target_type:'profile',target_id:userId,details})
   const {error}=await admin.auth.admin.deleteUser(userId);if(error)throw error
   return reply({ok:true})
  }else return reply({error:'Opération inconnue'},400)

  await admin.from('audit_events').insert({actor_id:caller.id,actor_name:caller.display_name,action:'user_'+operation,target_type:'profile',target_id:userId,details})
  return reply({ok:true})
 }catch(e){return reply({error:e?.message||'Erreur serveur'},400)}
})
