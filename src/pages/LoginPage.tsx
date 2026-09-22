import { FormEvent,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck,UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import type { Role } from '../lib/types'

export function LoginPage(){
 const {signIn}=useAuth()
 const navigate=useNavigate()
 const [managerEmail,setManagerEmail]=useState('olivier.marchegay@securitas.fr')
 const [managerPassword,setManagerPassword]=useState('')
 const [techEmail,setTechEmail]=useState('')
 const [techPassword,setTechPassword]=useState('')
 const [busy,setBusy]=useState<Role|null>(null)
 const [error,setError]=useState('')

 const submit=async(e:FormEvent,role:Role)=>{
  e.preventDefault()
  setBusy(role);setError('')
  const email=role==='manager'?managerEmail:techEmail
  const password=role==='manager'?managerPassword:techPassword
  try{
   await signIn(email,password,role)
   navigate('/')
  }catch(x){
   setError(x instanceof Error?x.message:'Connexion impossible')
  }finally{setBusy(null)}
 }

 return <div className="login-wrap">
  <section className="login-shell">
   <div className="login-brand"><span className="login-dots"><i/><i/><i/></span><div><h1>Planning Securitas</h1><p>Choisis ton type d’accès.</p></div></div>

   <div className="access-grid">
    <article className="access-card">
     <div className="access-head"><div className="access-avatar manager"><ShieldCheck size={21}/></div><div><b>Accès Manager</b><small>Tous les tickets, utilisateurs, KPI, clients, inventaire et configuration</small></div></div>
     <form onSubmit={e=>void submit(e,'manager')}>
      <label>Email Manager<input type="email" value={managerEmail} onChange={e=>setManagerEmail(e.target.value)} autoComplete="username" required/></label>
      <label>Mot de passe<input type="password" value={managerPassword} onChange={e=>setManagerPassword(e.target.value)} autoComplete="current-password" placeholder="Saisis ton mot de passe" required/></label>
      <button className="primary" disabled={busy!==null}>{busy==='manager'?'Connexion…':'Entrer en Manager'}</button>
     </form>
    </article>

    <article className="access-card">
     <div className="access-head"><div className="access-avatar technician"><UserRound size={21}/></div><div><b>Accès Technicien</b><small>Planning et tickets qui te sont assignés</small></div></div>
     <form onSubmit={e=>void submit(e,'technician')}>
      <label>Email Technicien<input type="email" value={techEmail} onChange={e=>setTechEmail(e.target.value)} autoComplete="username" required/></label>
      <label>Mot de passe<input type="password" value={techPassword} onChange={e=>setTechPassword(e.target.value)} autoComplete="current-password" required/></label>
      <button className="primary" disabled={busy!==null}>{busy==='technician'?'Connexion…':'Entrer en Technicien'}</button>
     </form>
     <div className="login-notice">Les comptes Techniciens sont créés par un Manager depuis la rubrique <b>Utilisateurs</b>.</div>
    </article>
   </div>

   {error&&<div className="alert error login-error">{error}</div>}
  </section>
 </div>
}
