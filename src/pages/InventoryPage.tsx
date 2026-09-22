import { FormEvent,useMemo,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { Boxes,ChevronRight,PackagePlus,Search,SlidersHorizontal,X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { InventoryItem } from '../lib/types'
import { inventoryAvailable } from '../lib/types'

type StockFilter='all'|'ok'|'low'|'out'
type ActiveFilter='all'|'active'|'inactive'
type PanelMode='none'|'detail'|'new'

export function InventoryPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()
 const [selected,setSelected]=useState<InventoryItem|null>(null)
 const [panelMode,setPanelMode]=useState<PanelMode>('none')
 const [search,setSearch]=useState('')
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

 const value=useMemo(()=>items.reduce((s,i)=>s+Number(i.unit_price||0)*i.quantity_total,0),[items])

 const openItem=(i:InventoryItem)=>{
  setSelected(i);setPanelMode('detail')
  setTimeout(()=>document.getElementById('inventory-detail')?.scrollIntoView({behavior:'smooth',block:'start'}),50)
 }

 const newItem=()=>{
  setSelected(null);setPanelMode('new')
  setTimeout(()=>document.getElementById('inventory-detail')?.scrollIntoView({behavior:'smooth',block:'start'}),50)
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

 const move=async(i:InventoryItem,type:string)=>{
  const raw=prompt(type==='STOCK_IN'?'Quantité à ajouter':'Quantité à retirer')
  if(!raw)return
  const quantity=Number(raw)
  if(!Number.isFinite(quantity)||quantity<=0)return
  const note=prompt('Commentaire / référence du mouvement')||''
  const {error}=await supabase.rpc('inventory_move',{p_item_id:i.id,p_type:type,p_quantity:quantity,p_note:note})
  if(error){alert(error.message);return}
  await qc.invalidateQueries({queryKey:['inventory']})
 }

 const reserve=async(i:InventoryItem)=>{
  const ticket=prompt('ID du ticket à réserver')
  if(!ticket)return
  const qty=Number(prompt('Quantité')||0)
  if(qty<=0)return
  const {error}=await supabase.rpc('reserve_inventory',{p_ticket_id:ticket,p_item_id:i.id,p_quantity:qty})
  if(error){alert(error.message);return}
  await qc.invalidateQueries({queryKey:['inventory']})
 }

 const hasFilters=!!(search||category||manufacturer||stock!=='all'||active!=='all')
 const selectedAvailable=selected?inventoryAvailable(selected):0

 return <div className="page inventory-page">
  <header className="page-head">
   <div><h1>{manager?'Inventaire':'Matériel'}</h1><p>Catalogue de références, disponibilité et détail au clic.</p></div>
   {manager&&<button className="primary page-primary-action" onClick={newItem}><PackagePlus size={16}/><span>Nouvelle référence</span></button>}
  </header>

  <section className="grid four inventory-kpis">
   <div className="kpi"><b>{items.length}</b><span>Références</span></div>
   <div className="kpi"><b>{items.reduce((s,i)=>s+inventoryAvailable(i),0)}</b><span>Unités disponibles</span></div>
   <div className="kpi danger"><b>{items.filter(i=>inventoryAvailable(i)<=i.stock_minimum).length}</b><span>Stocks faibles</span></div>
   <div className="kpi good"><b>{value.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</b><span>Valeur stock</span></div>
  </section>

  <section className="card module-filter-card">
   <div className="module-filter-title"><SlidersHorizontal size={16}/><b>Recherche & filtres</b><span>{rows.length} résultat{rows.length>1?'s':''}</span></div>
   <div className="module-filter-grid">
    <label className="wide-filter">Recherche
     <div className="input-with-icon"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="HP, EliteBook, dock, référence…"/></div>
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
    <div className="detail-panel-head"><div><small>{panelMode==='new'?'Création':'Fiche matériel'}</small><h2><Boxes size={18}/>{panelMode==='new'?' Nouvelle référence':[selected?.manufacturer,selected?.model].filter(Boolean).join(' ')}</h2></div><button className="ghost small" onClick={()=>{setPanelMode('none');setSelected(null)}}><X size={15}/></button></div>

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
     {manager&&<div className="detail-actions"><button className="secondary" onClick={()=>void move(selected,'STOCK_IN')}>+ Stock</button><button className="ghost" onClick={()=>void move(selected,'STOCK_OUT')}>- Stock</button><button className="ghost" onClick={()=>void reserve(selected)}>Réserver</button></div>}
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
 </div>
}
