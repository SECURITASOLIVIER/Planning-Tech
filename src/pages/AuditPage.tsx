import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function AuditPage(){
 const {data=[]}=useQuery({queryKey:['audit'],queryFn:async()=>{const {data,error}=await supabase.from('audit_events').select('*').order('created_at',{ascending:false}).limit(500);if(error)throw error;return data||[]}})
 return <div className="page"><header className="page-head"><div><h1>Audit</h1><p>Actions administratives, tickets et inventaire.</p></div></header><div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Cible</th><th>Acteur</th><th>Détails</th></tr></thead><tbody>{data.map((x:any)=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString('fr-FR')}</td><td><span className="badge">{x.action}</span></td><td>{x.target_type} {x.target_id||''}</td><td>{x.actor_name||x.actor_id||'Système'}</td><td><small>{JSON.stringify(x.details)}</small></td></tr>)}</tbody></table></div></div>
}
