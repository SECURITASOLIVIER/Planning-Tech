import { createClient } from 'npm:@supabase/supabase-js@2'

const json=(body:unknown,status=200,origin='*')=>new Response(JSON.stringify(body),{
  status,
  headers:{
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Vary':'Origin'
  }
})

function corsOrigin(req:Request){
  const origin=req.headers.get('Origin')||''
  const configured=(Deno.env.get('APP_ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean)
  if(configured.length===0)return '*'
  return configured.includes(origin)?origin:configured[0]
}

Deno.serve(async(req)=>{
  const origin=corsOrigin(req)
  if(req.method==='OPTIONS')return json({ok:true},200,origin)
  if(req.method!=='POST')return json({error:'Méthode non autorisée'},405,origin)

  try{
    const authHeader=req.headers.get('Authorization')||''
    if(!authHeader.startsWith('Bearer '))return json({error:'Non authentifié'},401,origin)

    const url=Deno.env.get('SUPABASE_URL')!
    const anon=Deno.env.get('SUPABASE_ANON_KEY')!
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient=createClient(url,anon,{global:{headers:{Authorization:authHeader}}})
    const {data:userData,error:userErr}=await callerClient.auth.getUser(authHeader.slice(7))
    if(userErr||!userData.user)return json({error:'Session invalide'},401,origin)

    const admin=createClient(url,service)
    const {data:caller,error:callerErr}=await admin.from('profiles').select('id,email,display_name,role,active').eq('id',userData.user.id).single()
    if(callerErr||!caller||caller.role!=='manager'||!caller.active)return json({error:'Accès Manager requis'},403,origin)

    const body=await req.json()
    const action=String(body.action||'')

    if(action==='upsert'){
      const format=String(body.format||'')
      const version=Number(body.format_version||0)
      const table=String(body.table||'')
      const rows=Array.isArray(body.rows)?body.rows:[]

      if(!['planning-securitas-xlsx-backup','planning-xlsx-backup'].includes(format))return json({error:'Format de sauvegarde non reconnu'},400,origin)
      if(version!==2)return json({error:'Version de sauvegarde non supportée'},400,origin)
      if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table))return json({error:'Nom de table invalide'},400,origin)
      if(rows.length>500)return json({error:'Lot trop volumineux'},400,origin)
      if(rows.length===0)return json({ok:true,table,processed:0},200,origin)

      const {data,error}=await admin.rpc('database_restore_chunk_internal',{p_table:table,p_rows:rows})
      if(error)throw new Error(table+' : '+error.message)
      return json({ok:true,table,processed:Number(data||0)},200,origin)
    }

    if(action==='finalize'){
      const counts=body.counts&&typeof body.counts==='object'?body.counts:{}
      const sourceFile=String(body.source_file||'').slice(0,240)
      const {data:resetCount,error:resetErr}=await admin.rpc('database_restore_finalize_internal')
      if(resetErr)throw resetErr

      const {error:logErr}=await admin.from('audit_events').insert({
        actor_id:caller.id,
        actor_name:caller.display_name,
        action:'database_business_backup_imported',
        target_type:'database',
        target_id:null,
        details:{
          mode:'upsert',
          source_file:sourceFile||null,
          table_counts:counts,
          sequences_reset:Number(resetCount||0)
        }
      })
      if(logErr)throw logErr

      return json({ok:true,sequences_reset:Number(resetCount||0)},200,origin)
    }

    return json({error:'Opération inconnue'},400,origin)
  }catch(e){
    return json({error:e instanceof Error?e.message:'Erreur serveur'},400,origin)
  }
})
