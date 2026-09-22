import { FormEvent,useMemo,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLine,ArrowUpFromLine,Boxes,ChevronRight,History,PackagePlus,Search,SlidersHorizontal,Wrench,X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { InventoryItem,InventoryMovement,Profile,Ticket } from '../lib/types'
import { inventoryAvailable } from '../lib/types'

type StockFilter='all'|'ok'|'low'|'out'
type ActiveFilter='all'|'active'|'inactive'
type PanelMode='none'|'detail'|'new'
type InventoryView='catalog'|'movements'

const movementLabels:Record<string,string>={
 STOCK_IN:'Entrée de stock',
 STOCK_OUT:'Sortie ponctuelle',
 INTERVENTION_USE:'Utilisation en intervention',
 RETURN:'Retour en stock',
 ADJUSTMENT_IN:'Correction +',
 ADJUSTMENT_OUT:'Correction -',
 LOST:'Perdu',
 BROKEN:'Cassé',
 RETIRED:'Réformé',
 RESERVATION:'Réservation',
 RESERVATION_CANCELLED:'Annulation réservation'
}

export function InventoryPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()
 const [view,setView]=useState<InventoryView>('catalog')
 const [selected,setSelected]=useState<InventoryItem|null>(null)
 const [panelMode,setPanelMode]=useState<PanelMode>('none')
 const [movementType,setMovementType]=useState('INTERVENTION_USE')
 const [movementOpen,setMovementOpen]=useState(false)
 const [search,setSearch]=useState('')
 const [movementSearch,setMovementSearch]=useState('')
 const [category,setCategory]=useState('')
 const [manufacturer,setManufacturer]=useState('')
 const [stock,setStock]=useState<StockFilter>('all')
 const [active,setActive]=useState<ActiveFilter>('all')

 const {data:items=[]}=useQuery({
  queryKey:['inventory'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('inventory_items').select('*').order('category').order('manufacturer').order('model')
   if(error)throw error
   return data as InventoryItem[]
  }
 })

 const {data:tickets=[]}=useQuery({
  queryKey:['tickets','inventory-usage'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('tickets').select('id,ticket_number,subject,assigned_to,status,created_at').order('created_at',{ascending:false}).limit(500)
   if(error)throw error
   return data as Pick<Ticket,'id'|'ticket_number'|'subject'|'assigned_to'|'status'|'created_at'>[]
  }
 })

 const {data:movements=[]}=useQuery({
  queryKey:['inventory_movements'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('inventory_movements').select('*').order('created_at',{ascending:false}).limit(500)
   if(error)throw error
   return data as InventoryMovement[]
  }
 })

 const {data:profiles=[]}=useQuery({
  queryKey:['profiles','inventory'],
  queryFn:async()=>{
   const {data,error}=await supabase.from('profiles').select('id,display_name,email,role,active,work_start,work_end,created_at').order('display_name')
   if(error)throw error
   return data as Profile[]
  }
 })

 const categories=useMemo(()=>[...new Set(items.map(i=>i.category).filter(Boolean))].sort(),[items])
 const manufacturers=useMemo(()=>[...new Set(items.map(i=>i.manufacturer).filter((x):x is string=>!!x))].sort(),[items])

 const rows=useMemo(()=>items.filter(i=>{
  const available=inventoryAvailable(i)
  const text=(i.category+' '+(i.manufacturer||'')+' '+i.model+' '+(i.reference||'')+' '+(i.location||'')).toLowerCase()
  if(search.trim()&&!text.includes(search.trim().toLowerCase()))return false
  if(category&&i.category!==category)return false
  if(manufacturer&&i.manufacturer!==manufacturer)return false
  if(active==='active'&&!i.active)return false
  if(active==='inactive'&&i.active)return false
  if(stock==='out'&&available>0)return false
  if(stock==='low'&&!(available>0&&available<=i.stock_minimum))return false
  if(stock==='ok'&&available<=i.stock_minimum)return false
  return true
 }),[items,search,category,manufacturer,stock,active])

 const movementRows=useMemo(()=>movements.filter(m=>{
  const item=items.find(i=>i.id===m.item_id)
  const q=movementSearch.trim().toLowerCase()
  const text=((item?.manufacturer||'')+' '+(item?.model||'')+' '+(item?.reference||'')+' '+m.movement_type+' '+m.reason+' '+(m.ticket_number_snapshot||'')+' '+(m.assignee||'')).toLowerCase()
  return !q||text.includes(q)
 }),[movements,items,movementSearch])

 const value=useMemo(()=>items.reduce((s,i)=>s+Number(i.unit_price||0)*i.quantity_total,0),[items])

 const openItem=(i:InventoryItem)=>{
  setSelected(i);setPanelMode('detail');setMovementOpen(false)
  setTimeout(()=>document.getElementById('inventory-detail')?.scrollIntoView({behavior:'smooth',block:'start'}),50)
 }

 const newItem=()=>{
  setSelected(null);setPanelMode('new');setMovementOpen(false);setView('catalog')
  setTimeout(()=>document.getElementById('inventory-detail')?.scrollIntoView({behavior:'smooth',block:'start'}),50)
 }

 const openMovement=(i:InventoryItem,type:string)=>{
  setSelected(i);setPanelMode('detail');setMovementType(type);setMovementOpen(true);setView('catalog')
  setTimeout(()=>document.getElementById('inventory-movement-form')?.scrollIntoView({behavior:'smooth',block:'center'}),80)
 }

 const clearFilters=()=>{setSearch('');setCategory('');setManufacturer('');setStock('all');setActive('all')}

 const save=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  const fd=new FormData(e.currentTarget)
  const row={
   category:String(fd.get('category')),
   manufacturer:String(fd.get('manufacturer')||'')||null,
   model:String(fd.get('model')),
   reference:String(fd.get('reference')||'')||null,
   description:String(fd.get('description')||'')||null,
   unit_price:Number(fd.get('unit_price')||0),
   quantity_total:Number(fd.get('quantity_total')||0),
   stock_minimum:Number(fd.get('stock_minimum')||0),
   location:String(fd.get('location')||'')||null,
   tracked_individually:fd.get('tracked')==='on',
   active:fd.get('active')==='on'
  }
  const q=selected?supabase.from('inventory_items').update(row).eq('id',selected.id):supabase.from('inventory_items').insert(row)
  const {error}=await q
  if(error){alert(error.message);return}
  setSelected(null);setPanelMode('none')
  await qc.invalidateQueries({queryKey:['inventory']})
 }

 const recordMovement=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault()
  if(!selected)return
  const fd=new FormData(e.currentTarget)
  const type=String(fd.get('movement_type'))
  const quantity=Number(fd.get('quantity')||0)
  const reason=String(fd.get('reason')||'').trim()
  const ticketId=String(fd.get('ticket_id')||'')||null
  const assignee=String(fd.get('assignee')||'').trim()||null
  if(quantity<=0){alert('Quantité invalide');return}
  if(!reason){alert('Le motif est obligatoire pour chaque mouvement');return}
  if(type==='INTERVENTION_USE'&&!ticketId){alert('Un ticket est obligatoire pour une utilisation en intervention');return}
  const {error}=await supabase.rpc('inventory_record_movement',{
   p_item_id:selected.id,p_type:type,p_quantity:quantity,p_reason:reason,p_ticket_id:ticketId,p_assignee:assignee
  })
  if(error){alert(error.message);return}
  setMovementOpen(false)
  await Promise.all([
   qc.invalidateQueries({queryKey:['inventory']}),
   qc.invalidateQueries({queryKey:['inventory_movements']})
  ])
 }

 const reserve=async(i:InventoryItem)=>{
  const ticket=prompt('ID du ticket à réserver')
  if(!ticket)return
  const qty=Number(prompt('Quantité')||0)
  if(qty<=0)return
  const {error}=await supabase.rpc('reserve_inventory',{p_ticket_id:ticket,p_item_id:i.id,p_quantity:qty})
  if(error){alert(error.message);return}
  await Promise.all([qc.invalidateQueries({queryKey:['inventory']}),qc.invalidateQueries({queryKey:['inventory_movements']})])
 }

 const hasFilters=!!(search||category||manufacturer||stock!=='all'||active!=='all')
 const selectedAvailable=selected?inventoryAvailable(selected):0
 const movementTypeOptions=manager
  ?['STOCK_IN','STOCK_OUT','INTERVENTION_USE','RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT','LOST','BROKEN','RETIRED']
  :['STOCK_IN','STOCK_OUT','INTERVENTION_USE','RETURN']

 return <div className="page inventory-page">
  <header className="page-head">
   <div><h1>{manager?'Inventaire':'Matériel'}</h1><p>Catalogue, entrées/sorties, utilisation en intervention et justification des mouvements.</p></div>
   {manager&&<button className="primary page-primary-action" onClick={newItem}><PackagePlus size={16}/><span>Nouvelle référence</span></button>}
  </header>

  <div className="module-tabs inventory-tabs">
   <button className={view==='catalog'?'primary':'ghost'} onClick={()=>setView('catalog')}><Boxes size={15}/> Catalogue</button>
   <button className={view==='movements'?'primary':'ghost'} onClick={()=>setView('movements')}><History size={15}/> Mouvements</button>
  </div>

  <section className="grid four inventory-kpis">
   <div className="kpi"><b>{items.length}</b><span>Références</span></div>
   <div className="kpi"><b>{items.reduce((s,i)=>s+inventoryAvailable(i),0)}</b><span>Unités disponibles</span></div>
   <div className="kpi danger"><b>{items.filter(i=>inventoryAvailable(i)<=i.stock_minimum).length}</b><span>Stocks faibles</span></div>
   <div className="kpi good"><b>{value.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</b><span>Valeur stock</span></div>
  </section>

  {view==='catalog'&&<>
   <section className="card module-filter-card">
    <div className="module-filter-title"><SlidersHorizontal size={16}/><b>Recherche & filtres</b><span>{rows.length} résultat{rows.length>1?'s':''}</span></div>
    <div className="module-filter-grid">
     <label className="wide-filter">Recherche
      <div className="input-with-icon"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="HP, EliteBook, switch, caméra, référence…"/></div>
     </label>
     <label>Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Toutes</option>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
     <label>Constructeur<select value={manufacturer} onChange={e=>setManufacturer(e.target.value)}><option value="">Tous</option>{manufacturers.map(x=><option key={x}>{x}</option>)}</select></label>
     <label>Stock<select value={stock} onChange={e=>setStock(e.target.value as StockFilter)}><option value="all">Tous</option><option value="ok">Stock OK</option><option value="low">Stock faible</option><option value="out">Rupture</option></select></label>
     <label>État<select value={active} onChange={e=>setActive(e.target.value as ActiveFilter)}><option value="all">Tous</option><option value="active">Actifs</option><option value="inactive">Inactifs</option></select></label>
     {hasFilters&&<button className="ghost filter-clear" onClick={clearFilters}><X size={14}/> Effacer</button>}
    </div>
   </section>

   <div className={panelMode!=='none'?'module-layout with-detail':'module-layout'}>
    <section className="reference-grid">
     {rows.length===0&&<div className="card empty-state">Aucune référence ne correspond aux filtres.</div>}
     {rows.map(i=>{
      const available=inventoryAvailable(i)
      const state=available<=0?'out':available<=i.stock_minimum?'low':'ok'
      return <article className={'reference-card '+(selected?.id===i.id?'selected':'')} key={i.id} onClick={()=>openItem(i)}>
       <div className="reference-card-head">
        <div><span className="reference-category">{i.category}</span><b>{[i.manufacturer,i.model].filter(Boolean).join(' ')}</b><small>{i.reference||'Sans référence'}</small></div>
        <ChevronRight size={18}/>
       </div>
       <div className="reference-price">{Number(i.unit_price).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</div>
       <div className="reference-stockline"><span className={'stock-pill '+state}>{state==='out'?'Rupture':state==='low'?'Stock faible':'Stock OK'}</span><b>{available} disponible{available>1?'s':''}</b></div>
       <div className="reference-metrics"><div><span>Total</span><b>{i.quantity_total}</b></div><div><span>Réservé</span><b>{i.quantity_reserved}</b></div><div><span>Attribué</span><b>{i.quantity_assigned}</b></div></div>
       <div className="reference-foot"><span>📍 {i.location||'Non défini'}</span><span className={'badge '+(i.active?'green':'red')}>{i.active?'Actif':'Inactif'}</span></div>
      </article>
     })}
    </section>

    {panelMode!=='none'&&<aside className="panel detail-panel" id="inventory-detail">
     <div className="detail-panel-head"><div><small>{panelMode==='new'?'Création':'Fiche matériel'}</small><h2><Boxes size={18}/>{panelMode==='new'?' Nouvelle référence':[selected?.manufacturer,selected?.model].filter(Boolean).join(' ')}</h2></div><button className="ghost small" onClick={()=>{setPanelMode('none');setSelected(null);setMovementOpen(false)}}><X size={15}/></button></div>

     {panelMode==='detail'&&selected&&<>
      <div className="detail-summary-grid">
       <div><span>Référence</span><b>{selected.reference||'—'}</b></div>
       <div><span>Catégorie</span><b>{selected.category}</b></div>
       <div><span>Prix unitaire</span><b>{Number(selected.unit_price).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</b></div>
       <div><span>Emplacement</span><b>{selected.location||'—'}</b></div>
      </div>
      <div className="detail-stock-grid">
       <div><span>Total</span><b>{selected.quantity_total}</b></div><div><span>Réservé</span><b>{selected.quantity_reserved}</b></div><div><span>Attribué</span><b>{selected.quantity_assigned}</b></div><div><span>Disponible</span><b>{selectedAvailable}</b></div>
      </div>
      {selected.description&&<div className="detail-description">{selected.description}</div>}
      <div className="detail-actions inventory-movement-actions">
       <button className="secondary" onClick={()=>openMovement(selected,'STOCK_IN')}><ArrowDownToLine size={14}/> Entrée</button>
       <button className="ghost" onClick={()=>openMovement(selected,'STOCK_OUT')}><ArrowUpFromLine size={14}/> Sortie</button>
       <button className="primary" onClick={()=>openMovement(selected,'INTERVENTION_USE')}><Wrench size={14}/> Intervention</button>
       <button className="ghost" onClick={()=>openMovement(selected,'RETURN')}>Retour</button>
       <button className="ghost" onClick={()=>void reserve(selected)}>Réserver</button>
      </div>

      {movementOpen&&<form className="movement-form card" id="inventory-movement-form" onSubmit={recordMovement}>
       <h3 className="section-title">Enregistrer un mouvement</h3>
       <div className="form-grid">
        <label>Type<select name="movement_type" value={movementType} onChange={e=>setMovementType(e.target.value)}>{movementTypeOptions.map(x=><option key={x} value={x}>{movementLabels[x]||x}</option>)}</select></label>
        <label>Quantité<input name="quantity" type="number" min="1" defaultValue="1" required/></label>
        <label className="full">Ticket {movementType==='INTERVENTION_USE'?'(obligatoire)':'(optionnel)'}<select name="ticket_id" required={movementType==='INTERVENTION_USE'}><option value="">— Aucun ticket —</option>{tickets.map(t=><option key={t.id} value={t.id}>{t.ticket_number} • {t.subject}</option>)}</select></label>
        <label className="full">Utilisateur / bénéficiaire<input name="assignee" placeholder="Nom de la personne, site ou équipe"/></label>
        <label className="full">Motif obligatoire<textarea name="reason" placeholder="Pourquoi ce matériel entre/sort ? À quoi sert-il ? Contexte de l’intervention…" required/></label>
        <button className="primary full">Valider le mouvement</button>
       </div>
      </form>}
     </>}

     {manager&&<form className="form-grid detail-form" onSubmit={save} key={selected?.id||'new'}>
      <label>Catégorie<input name="category" defaultValue={selected?.category||''} required/></label>
      <label>Constructeur<input name="manufacturer" defaultValue={selected?.manufacturer||''}/></label>
      <label className="full">Modèle<input name="model" defaultValue={selected?.model||''} required/></label>
      <label>Référence<input name="reference" defaultValue={selected?.reference||''}/></label>
      <label>Prix unitaire €<input name="unit_price" type="number" min="0" step="0.01" defaultValue={selected?.unit_price||0}/></label>
      <label>Quantité totale<input name="quantity_total" type="number" min="0" defaultValue={selected?.quantity_total||0}/></label>
      <label>Stock minimum<input name="stock_minimum" type="number" min="0" defaultValue={selected?.stock_minimum||0}/></label>
      <label>Emplacement<input name="location" defaultValue={selected?.location||''}/></label>
      <label className="full">Description<textarea name="description" defaultValue={selected?.description||''}/></label>
      <label className="full check-label"><input name="tracked" type="checkbox" defaultChecked={selected?.tracked_individually}/> Suivi unitaire / numéro de série</label>
      <label className="full check-label"><input name="active" type="checkbox" defaultChecked={selected?.active??true}/> Référence active</label>
      <button className="primary full">Enregistrer</button>
     </form>}
    </aside>}
   </div>
  </>}

  {view==='movements'&&<>
   <section className="card module-filter-card">
    <div className="module-filter-title"><History size={16}/><b>Historique des mouvements</b><span>{movementRows.length} mouvement{movementRows.length>1?'s':''}</span></div>
    <div className="module-filter-grid"><label className="wide-filter">Recherche<input value={movementSearch} onChange={e=>setMovementSearch(e.target.value)} placeholder="Matériel, motif, ticket, bénéficiaire…"/></label></div>
   </section>

   <div className="table-wrap desktop-only"><table><thead><tr><th>Date</th><th>Matériel</th><th>Mouvement</th><th>Qté</th><th>Ticket</th><th>Motif</th><th>Bénéficiaire</th><th>Acteur</th></tr></thead><tbody>{movementRows.map(m=>{const i=items.find(x=>x.id===m.item_id);const actor=profiles.find(p=>p.id===m.actor_id);return <tr key={m.id}><td>{new Date(m.created_at).toLocaleString('fr-FR')}</td><td><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||m.item_id}</b><br/><small>{i?.reference||''}</small></td><td><span className="badge">{movementLabels[m.movement_type]||m.movement_type}</span></td><td>{m.quantity}</td><td>{m.ticket_number_snapshot||'—'}</td><td>{m.reason}</td><td>{m.assignee||'—'}</td><td>{actor?.display_name||m.actor_id||'Système'}</td></tr>})}</tbody></table></div>

   <div className="module-mobile-list">{movementRows.map(m=>{const i=items.find(x=>x.id===m.item_id);const actor=profiles.find(p=>p.id===m.actor_id);return <article className="module-mobile-card" key={m.id}><div className="module-mobile-head"><div><b>{[i?.manufacturer,i?.model].filter(Boolean).join(' ')||'Matériel'}</b><small>{new Date(m.created_at).toLocaleString('fr-FR')} • {m.ticket_number_snapshot||'Sans ticket'}</small></div><span className="badge">{movementLabels[m.movement_type]||m.movement_type}</span></div><div className="module-mobile-meta"><div><span>Quantité</span><b>{m.quantity}</b></div><div><span>Acteur</span><b>{actor?.display_name||'Utilisateur'}</b></div><div><span>Bénéficiaire</span><b>{m.assignee||'—'}</b></div><div><span>Stock</span><b>{m.old_total??'—'} → {m.new_total??'—'}</b></div></div><div className="detail-description"><b>Motif :</b> {m.reason}</div></article>})}</div>
  </>}
 </div>
}
