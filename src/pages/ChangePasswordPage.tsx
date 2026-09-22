import { FormEvent,useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

export function ChangePasswordPage(){
 const {session,profile,refreshProfile}=useAuth()
 const [p1,setP1]=useState(''),[p2,setP2]=useState(''),[msg,setMsg]=useState('')
 if(!session)return <Navigate to="/login" replace/>
 if(profile&&!profile.force_password_change)return <Navigate to="/" replace/>
 const submit=async(e:FormEvent)=>{e.preventDefault();if(p1.length<10){setMsg('10 caractères minimum');return}if(p1!==p2){setMsg('Les mots de passe diffèrent');return}
  const {error}=await supabase.auth.updateUser({password:p1});if(error){setMsg(error.message);return}
  const {error:rpcErr}=await supabase.rpc('complete_password_change');if(rpcErr){setMsg(rpcErr.message);return}
  await refreshProfile();setMsg('Mot de passe modifié')
 }
 return <div className="login-wrap"><section className="login-card"><h1>Changer le mot de passe</h1><p>Un nouveau mot de passe est obligatoire avant de continuer.</p>
 <form onSubmit={submit}><label>Nouveau mot de passe<input type="password" value={p1} onChange={e=>setP1(e.target.value)}/></label><label>Confirmation<input type="password" value={p2} onChange={e=>setP2(e.target.value)}/></label>{msg&&<div className="alert">{msg}</div>}<button className="primary">Enregistrer</button></form></section></div>
}
