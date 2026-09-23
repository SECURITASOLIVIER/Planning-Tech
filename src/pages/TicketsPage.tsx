import { FormEvent,useEffect,useMemo,useState } from 'react'
import { useQuery,useQueryClient } from '@tanstack/react-query'
import { CheckCircle2,Download,History,Mail,MessageSquarePlus,MessageSquareText,Package,Plus,RotateCcw,Save,Search,Trash2,UserPlus } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/notify'
import { useAuth } from '../auth/AuthProvider'
import { addSheet,downloadWorkbook,excelDate } from '../lib/excel'
import { buildTicketNotification,type TicketNotificationType } from '../lib/ticketNotification'
import { DetailDrawer } from '../components/DetailDrawer'
import { TicketNotificationDialog,type PendingTicketNotification } from '../components/TicketNotificationDialog'
import { TicketCommunicationPicker } from '../components/TicketCommunicationPicker'
import { TicketClosureDialog } from '../components/TicketClosureDialog'
import { applyTicketContext,mailtoForTemplate } from '../lib/ticketCommunication'
import type { CommunicationTemplate,Customer,CustomerContact,InventoryItem,Profile,Ticket } from '../lib/types'

type DateField='created_at'|'arrival_at'|'planned_start'|'closed_at'
const emptyTicket=():Partial<Ticket>=>({subject:'',requester:'',description:'',category:'',intervention_type:'',status:'',priority:'',assigned_to:null,arrival_at:new Date().toISOString(),planned_start:null,planned_end:null,is_blocking:false,parent_incident:null,general_incident_label:null,customer_id:null,customer_contact_id:null})
const validEmail=(email:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export function TicketsPage(){
 const {profile}=useAuth()
 const manager=profile?.role==='manager'
 const qc=useQueryClient()

 const [selected,setSelected]=useState<Partial<Ticket>|null>(null)
 const [search,setSearch]=useState('')
 const [from,setFrom]=useState('')
 const [to,setTo]=useState('')
 const [dateField,setDateField]=useState<DateField>('created_at')
 const [technician,setTechnician]=useState('')
 const [requester,setRequester]=useState('')
 const [customer,setCustomer]=useState('')
 const [statusFilter,setStatusFilter]=useState('')
 const [priorityFilter,setPriorityFilter]=useState('')
 const [recipientEmails,setRecipientEmails]=useState<string[]>([])
 const [recipientInput,setRecipientInput]=useState('')
 const [draftCustomerId,setDraftCustomerId]=useState('')
 const [pendingNotification,setPendingNotification]=useState<PendingTicketNotification|null>(null)
 const [commentText,setCommentText]=useState('')
 const [commentBusy,setCommentBusy]=useState(false)
 const [communicationTarget,setCommunicationTarget]=useState<'comment'|'closure'|null>(null)
 const [closureOpen,setClosureOpen]=useState(false)
 const [closureText,setClosureText]=useState('')
 const [closureBusy,setClosureBusy]=useState(false)
 const [materialLabel,setMaterialLabel]=useState('')
 const [materialQty,setMaterialQty]=useState(1)
 const [materialNote,setMaterialNote]=useState('')
 const [editingMaterialId,setEditingMaterialId]=useState<string|null>(null)
 const [stockItemId,setStockItemId]=useState('')
 const [stockQty,setStockQty]=useState(1)
 const [stockReason,setStockReason]=useState('')
 const [materialBusy,setMaterialBusy]=useState(false)

 const {data:tickets=[]}=useQuery({queryKey:['tickets'],queryFn:async()=>{const {data,error}=await supabase.from('tickets').select('*').order('arrival_at',{ascending:false});if(error)throw error;return data as Ticket[]}})
 const {data:profiles=[]}=useQuery({queryKey:['profiles','tickets'],queryFn:async()=>{const {data,error}=await supabase.from('profiles').select('*').order('display_name');if(error)throw error;return data as Profile[]}})
 const {data:config=[]}=useQuery({queryKey:['config'],queryFn:async()=>{const {data,error}=await supabase.from('config_values').select('*').eq('active',true).order('sort_order');if(error)throw error;return data||[]}})
 const {data:customers=[]}=useQuery({queryKey:['customers','tickets'],queryFn:async()=>{const {data,error}=await supabase.from('customers').select('*').order('name');if(error)throw error;return data as Customer[]}})
 const {data:customerContacts=[]}=useQuery({queryKey:['customer-contacts','tickets'],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('customer_contacts').select('*').eq('active',true).order('last_name');if(error)throw error;return data as CustomerContact[]}})
 const {data:distribution=[]}=useQuery({queryKey:['notification-distribution'],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('notification_distribution_recipients').select('*').eq('active',true).order('sort_order');if(error)throw error;return data||[]}})
 const {data:communicationTemplates=[]}=useQuery({queryKey:['communication_templates','tickets'],queryFn:async()=>{const {data,error}=await supabase.from('communication_templates').select('*').eq('channel','Outlook').eq('active',true).order('theme').order('sort_order').order('title');if(error)throw error;return data as CommunicationTemplate[]}})
 const {data:materialsCatalog=[]}=useQuery({queryKey:['materials-catalog','tickets'],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('materials_catalog').select('*').eq('active',true).order('label');if(error)throw error;return data||[]}})
 const {data:inventoryItems=[]}=useQuery({queryKey:['inventory','tickets'],enabled:manager,queryFn:async()=>{const {data,error}=await supabase.from('inventory_items').select('*').eq('active',true).order('category').order('model');if(error)throw error;return data as InventoryItem[]}})

 const {data:comments=[]}=useQuery({queryKey:['comments',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_comments').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:history=[]}=useQuery({queryKey:['ticket-history-detail',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_history').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:materials=[]}=useQuery({queryKey:['ticket-materials-detail',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_materials').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:movements=[]}=useQuery({queryKey:['ticket-stock-detail',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('inventory_movements').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})
 const {data:ticketRecipients=[]}=useQuery({queryKey:['ticket-notification-recipients',selected?.id],enabled:manager&&!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_notification_recipients').select('*').eq('ticket_id',selected!.id!).order('created_at');if(error)throw error;return data||[]}})
 const {data:ticketNotifications=[]}=useQuery({queryKey:['ticket-notifications',selected?.id],enabled:manager&&!!selected?.id,queryFn:async()=>{const {data,error}=await supabase.from('ticket_notifications').select('*').eq('ticket_id',selected!.id!).order('created_at',{ascending:false});if(error)throw error;return data||[]}})

 const cfg=(kind:string)=>config.filter((x:any)=>x.kind===kind)
 const defaultLabel=(kind:string,code:string)=>cfg(kind).find((x:any)=>x.code===code)?.label||''
 const techName=(id:string|null|undefined)=>profiles.find(p=>p.id===id)?.display_name||'Non affecté'
 const clientName=(id:string|null|undefined)=>customers.find(c=>c.id===id)?.name||'—'
 const requesters=useMemo(()=>[...new Set(tickets.map(t=>t.requester).filter((x):x is string=>!!x?.trim()))].sort((a,b)=>a.localeCompare(b,'fr')),[tickets])
 const selectedMaterialCost=useMemo(()=>movements.filter((m:any)=>m.movement_type==='INTERVENTION_USE').reduce((sum:number,m:any)=>sum+Number(m.total_cost_snapshot||0),0),[movements])
 const selectedInterventionCost=Number(selected?.intervention_cost||0)
 const selectedTotalCost=selectedInterventionCost+selectedMaterialCost
 const money=(v:number)=>v.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})

 const rows=useMemo(()=>tickets.filter(t=>{
  const q=search.trim().toLowerCase()
  if(q&&!((t.ticket_number+' '+t.subject+' '+(t.requester||'')+' '+(t.description||'')+' '+clientName(t.customer_id)+' '+techName(t.assigned_to)).toLowerCase().includes(q)))return false
  if(technician&&t.assigned_to!==technician)return false
  if(requester&&t.requester!==requester)return false
  if(customer&&t.customer_id!==customer)return false
  if(statusFilter&&t.status!==statusFilter)return false
  if(priorityFilter&&t.priority!==priorityFilter)return false
  if(from||to){
   const raw=t[dateField]
   if(!raw)return false
   const ts=new Date(raw).getTime()
   if(from&&ts<new Date(from+'T00:00:00').getTime())return false
   if(to&&ts>=new Date(new Date(to+'T00:00:00').getTime()+86400000).getTime())return false
  }
  return true
 }),[tickets,search,technician,requester,customer,statusFilter,priorityFilter,from,to,dateField,profiles,customers])

 const customerSuggestions=useMemo(()=>{
  const emails:{email:string;label:string}[]=[]
  const c=customers.find(x=>x.id===draftCustomerId)
  if(c?.email)emails.push({email:c.email.toLowerCase(),label:c.name+' • e-mail principal'})
  for(const contact of customerContacts.filter(x=>x.customer_id===draftCustomerId&&x.email)){
   emails.push({email:contact.email!.toLowerCase(),label:((contact.first_name||'')+' '+(contact.last_name||'')).trim()||contact.email!})
  }
  return emails.filter((x,i,a)=>a.findIndex(y=>y.email===x.email)===i&&!recipientEmails.includes(x.email))
 },[draftCustomerId,customers,customerContacts,recipientEmails])

 useEffect(()=>{if(selected&&!selected.id){setSelected(s=>({...s,status:s?.status||defaultLabel('status','new'),priority:s?.priority||defaultLabel('priority','normal'),category:s?.category||cfg('category')[0]?.label||'',intervention_type:s?.intervention_type||cfg('type')[0]?.label||''}))}},[config])
 useEffect(()=>{if(manager&&selected?.id)setRecipientEmails(ticketRecipients.map((x:any)=>String(x.email).toLowerCase()))},[manager,selected?.id,ticketRecipients])

 const openTicket=(t:Ticket)=>{setSelected(t);setDraftCustomerId(t.customer_id||'');setRecipientEmails([]);setRecipientInput('');setCommentText('');setClosureText('');setClosureOpen(false);setCommunicationTarget(null);setEditingMaterialId(null);setMaterialLabel('');setMaterialQty(1);setMaterialNote('');setStockItemId('');setStockQty(1);setStockReason('')}
 const newTicket=()=>{setSelected({...emptyTicket(),assigned_to:manager?null:profile?.id||null});setDraftCustomerId('');setRecipientEmails([]);setRecipientInput('');setCommentText('');setClosureText('');setClosureOpen(false);setCommunicationTarget(null);setEditingMaterialId(null);setMaterialLabel('');setMaterialQty(1);setMaterialNote('');setStockItemId('');setStockQty(1);setStockReason('')}
 const clearFilters=()=>{setSearch('');setFrom('');setTo('');setTechnician('');setRequester('');setCustomer('');setStatusFilter('');setPriorityFilter('');setDateField('created_at')}

 const addRecipient=(emailRaw?:string)=>{
  const email=(emailRaw??recipientInput).trim().toLowerCase()
  if(!email)return
  if(!validEmail(email)){notify('Adresse e-mail invalide.','error');return}
  if(recipientEmails.includes(email)){notify('Cette adresse est déjà ajoutée.','info');return}
   setRecipientEmails(prev=>[...prev,email]);setRecipientInput('')
 }
 const removeRecipient=(email:string)=>setRecipientEmails(prev=>prev.filter(x=>x!==email))

 const syncRecipients=async(ticketId:string)=>{
  if(!manager)return
  const {error}=await supabase.rpc('set_ticket_notification_recipients',{p_ticket_id:ticketId,p_emails:recipientEmails})
  if(error)throw error
  await qc.invalidateQueries({queryKey:['ticket-notification-recipients',ticketId]})
 }

 const prepareNotification=async(ticket:Ticket,type:TicketNotificationType)=>{
  if(!manager)return
  const recipientList=[...new Set([
   ...distribution.map((x:any)=>String(x.email).trim().toLowerCase()),
   ...recipientEmails
  ].filter(Boolean))]
  const {data:historyData,error:historyError}=await supabase.rpc('ticket_notification_history',{p_ticket_id:ticket.id})
  if(historyError)notify('Historique du mail incomplet : '+historyError.message,'error')
  const built=buildTicketNotification(type,ticket,clientName(ticket.customer_id),techName(ticket.assigned_to),historyData||undefined)
  const {data,error}=await supabase.rpc('begin_ticket_notification',{
   p_ticket_id:ticket.id,p_notification_type:type,p_subject:built.subject,p_body:built.body,p_recipients:recipientList
  })
  if(error){notify('Ticket enregistré, mais préparation de la notification impossible : '+error.message,'error');return}
  setPendingNotification({
   notificationId:Number(data),ticketId:ticket.id,ticketNumber:ticket.ticket_number,type,recipients:recipientList,subject:built.subject,body:built.body
  })
  await qc.invalidateQueries({queryKey:['ticket-notifications',ticket.id]})
 }

 const save=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();if(!selected)return
  const fd=new FormData(e.currentTarget)
  const row:any={
   subject:String(fd.get('subject')),requester:String(fd.get('requester')||'')||null,description:String(fd.get('description')||'')||null,
   category:String(fd.get('category')),intervention_type:String(fd.get('type')),status:String(fd.get('status')),priority:String(fd.get('priority')),
   assigned_to:manager?(String(fd.get('assigned_to')||'')||null):(profile?.id||null),customer_id:String(fd.get('customer_id')||'')||null,
   is_blocking:fd.get('blocking')==='on',parent_incident:String(fd.get('parent_incident')||'')||null,
   general_incident_label:String(fd.get('general_incident_label')||'')||null,
   planned_start:fd.get('planned_start')?new Date(String(fd.get('planned_start'))).toISOString():null,
   planned_end:fd.get('planned_end')?new Date(String(fd.get('planned_end'))).toISOString():null
  }
  if(manager){
   row.intervention_cost=Math.max(0,Number(fd.get('intervention_cost')||0))
   row.intervention_cost_note=String(fd.get('intervention_cost_note')||'').trim()||null
  }

  let saved:Ticket
  let action:TicketNotificationType
  if(selected.id){
   const {data,error}=await supabase.from('tickets').update(row).eq('id',selected.id).select().single()
   if(error){notify(error.message,'error');return}
   saved=data as Ticket;action='update';notify('Ticket modifié avec succès.')
  }else{
   row.ticket_number='INC-'+Date.now().toString().slice(-9);row.created_by=profile?.id
   const {data,error}=await supabase.from('tickets').insert(row).select().single()
   if(error){notify(error.message,'error');return}
   saved=data as Ticket;action='create';notify('Ticket créé avec succès.')
  }

  if(manager){
   try{await syncRecipients(saved.id)}catch(e:any){notify('Ticket enregistré, mais les destinataires n’ont pas pu être enregistrés : '+(e?.message||'erreur'),'error')}
  }
  setSelected(saved);setDraftCustomerId(saved.customer_id||'')
  await qc.invalidateQueries({queryKey:['tickets']})
  if(manager)await prepareNotification(saved,action)
 }

 const addComment=async(scope:'internal'|'notification')=>{
  if(!selected?.id||!profile)return
  if(scope==='notification'&&!manager){notify('Les notifications sont réservées au Manager.','error');return}
  const body=commentText.trim()
  if(!body){notify('Saisis un commentaire avant de l’ajouter.','error');return}
  try{
   setCommentBusy(true)
   const {error}=await supabase.from('ticket_comments').insert({ticket_id:selected.id,author_id:profile.id,body,comment_scope:scope})
   if(error){notify(error.message,'error');return}
   setCommentText('')
   notify(scope==='internal'?'Commentaire interne ajouté.':'Commentaire notification ajouté.')
   await qc.invalidateQueries({queryKey:['comments',selected.id]})
   if(scope==='notification'&&manager){
    await prepareNotification(selected as Ticket,'comment')
   }
  }finally{setCommentBusy(false)}
 }

 const openClosure=()=>{setClosureText(selected?.resolution_comment||'');setClosureOpen(true)}
 const close=async()=>{
  if(!selected?.id)return
  const resolution=closureText.trim()
  if(!resolution){notify('Le commentaire de résolution est obligatoire.','error');return}
  try{
   setClosureBusy(true)
   const {error}=await supabase.rpc('close_ticket',{p_ticket_id:selected.id,p_resolution:resolution})
   if(error){notify(error.message,'error');return}
   const {data,error:fetchError}=await supabase.from('tickets').select('*').eq('id',selected.id).single()
   if(fetchError){notify('Ticket clôturé, mais relecture impossible : '+fetchError.message,'error');return}
   const saved=data as Ticket
   setSelected(saved);setClosureOpen(false);notify('Ticket clôturé.')
   await qc.invalidateQueries({queryKey:['tickets']})
   if(manager)await prepareNotification(saved,'close')
  }finally{setClosureBusy(false)}
 }

 const ticketRecipientList=()=>[...new Set([
  ...distribution.map((x:any)=>String(x.email).trim().toLowerCase()),
  ...recipientEmails
 ].filter(Boolean))]

 const logCommunicationUse=async(template:CommunicationTemplate,usage:string,details:Record<string,unknown>={})=>{
  if(!selected?.id)return
  const {error}=await supabase.rpc('log_ticket_communication_usage',{p_ticket_id:selected.id,p_template_id:template.id,p_usage:usage,p_details:details})
  if(error)notify('Traçabilité communication incomplète : '+error.message,'error')
 }

 const communicationContent=(template:CommunicationTemplate)=>{
  if(!selected?.id)return {subject:template.subject||'',body:template.body}
  return applyTicketContext(template,{
   ticket:selected as Ticket,
   clientName:clientName(selected.customer_id),
   technicianName:techName(selected.assigned_to)
  })
 }

 const insertCommunication=async(template:CommunicationTemplate)=>{
  if(!manager){notify('Communication de notification réservée au Manager.','error');return}
  const prepared=communicationContent(template)
  if(communicationTarget==='comment'){
   setCommentText(prev=>[prev.trim(),prepared.body.trim()].filter(Boolean).join('\n\n'))
   await logCommunicationUse(template,'insert_comment',{target:'comment'})
   notify('Modèle inséré dans le commentaire.')
  }else if(communicationTarget==='closure'){
   setClosureText(prev=>[prev.trim(),prepared.body.trim()].filter(Boolean).join('\n\n'))
   await logCommunicationUse(template,'insert_closure',{target:'closure'})
   notify('Modèle inséré dans la résolution.')
  }
  setCommunicationTarget(null)
 }

 const copyCommunication=async(template:CommunicationTemplate)=>{
  if(!manager){notify('Communication de notification réservée au Manager.','error');return}
  const prepared=communicationContent(template)
  await navigator.clipboard.writeText([prepared.subject?('Objet : '+prepared.subject):'',prepared.body].filter(Boolean).join('\n\n'))
  await logCommunicationUse(template,'copy',{target:communicationTarget})
  notify('Communication copiée.')
 }

 const mailCommunication=async(template:CommunicationTemplate)=>{
  if(!manager){notify('Communication de notification réservée au Manager.','error');return}
  const prepared=communicationContent(template)
  await logCommunicationUse(template,'open_mail',{target:communicationTarget,recipients:ticketRecipientList()})
  window.location.href=mailtoForTemplate(ticketRecipientList(),prepared.subject,prepared.body)
 }

 const startEditMaterial=(m:any)=>{if(!manager){notify('Gestion du matériel réservée au Manager.','error');return}setEditingMaterialId(m.id);setMaterialLabel(m.label||'');setMaterialQty(Number(m.quantity||1));setMaterialNote(m.note||'')}
 const resetMaterialEditor=()=>{setEditingMaterialId(null);setMaterialLabel('');setMaterialQty(1);setMaterialNote('')}

 const saveMaterial=async()=>{
  if(!manager){notify('Gestion du matériel réservée au Manager.','error');return}
  if(!selected?.id)return
  const label=materialLabel.trim()
  if(!label){notify('Le libellé du matériel est obligatoire.','error');return}
  if(materialQty<1){notify('La quantité doit être au moins de 1.','error');return}
  try{
   setMaterialBusy(true)
   if(editingMaterialId){
    const {error}=await supabase.from('ticket_materials').update({label,quantity:materialQty,note:materialNote.trim()||null}).eq('id',editingMaterialId)
    if(error){notify(error.message,'error');return}
    notify('Matériel corrigé dans le ticket.')
   }else{
    const catalog=materialsCatalog.find((x:any)=>x.label===label)
    const {error}=await supabase.from('ticket_materials').insert({ticket_id:selected.id,catalog_id:catalog?.id||null,label,quantity:materialQty,note:materialNote.trim()||null})
    if(error){notify(error.message,'error');return}
    notify('Matériel ajouté au ticket.')
   }
   resetMaterialEditor()
   await Promise.all([
    qc.invalidateQueries({queryKey:['ticket-materials-detail',selected.id]}),
    qc.invalidateQueries({queryKey:['ticket-history-detail',selected.id]})
   ])
  }finally{setMaterialBusy(false)}
 }

 const removeMaterial=async(m:any)=>{
  if(!manager){notify('Gestion du matériel réservée au Manager.','error');return}
  if(!selected?.id)return
  if(!confirm('Retirer "'+m.label+'" du ticket ?'))return
  const {error}=await supabase.from('ticket_materials').delete().eq('id',m.id)
  if(error){notify(error.message,'error');return}
  if(editingMaterialId===m.id)resetMaterialEditor()
  notify('Matériel retiré du ticket.')
  await Promise.all([
   qc.invalidateQueries({queryKey:['ticket-materials-detail',selected.id]}),
   qc.invalidateQueries({queryKey:['ticket-history-detail',selected.id]})
  ])
 }

 const useStockMaterial=async()=>{
  if(!manager){notify('Gestion du stock réservée au Manager.','error');return}
  if(!selected?.id)return
  if(!stockItemId){notify('Choisis une référence de l’inventaire.','error');return}
  if(stockQty<1){notify('La quantité doit être au moins de 1.','error');return}
  if(!stockReason.trim()){notify('Le motif d’utilisation est obligatoire.','error');return}
  const item=inventoryItems.find(i=>i.id===stockItemId)
  if(!item)return
  try{
   setMaterialBusy(true)
   const {error}=await supabase.rpc('inventory_record_movement',{
    p_item_id:stockItemId,p_type:'INTERVENTION_USE',p_quantity:stockQty,p_reason:stockReason.trim(),p_ticket_id:selected.id,p_assignee:selected.requester||null
   })
   if(error){notify(error.message,'error');return}
   notify('Matériel sorti du stock et lié à l’intervention.')
   setStockItemId('');setStockQty(1);setStockReason('')
   await Promise.all([
    qc.invalidateQueries({queryKey:['ticket-stock-detail',selected.id]}),
    qc.invalidateQueries({queryKey:['ticket-history-detail',selected.id]}),
    qc.invalidateQueries({queryKey:['inventory']}),
    qc.invalidateQueries({queryKey:['inventory','tickets']})
   ])
  }finally{setMaterialBusy(false)}
 }

 const reopen=async()=>{
  if(!selected?.id)return
  const {error}=await supabase.rpc('reopen_ticket',{p_ticket_id:selected.id})
  if(error){notify(error.message,'error');return}
  const {data,error:fetchError}=await supabase.from('tickets').select('*').eq('id',selected.id).single()
  if(fetchError){notify('Ticket rouvert, mais relecture impossible : '+fetchError.message,'error');return}
  const saved=data as Ticket
  setSelected(saved);notify('Ticket rouvert.')
  await qc.invalidateQueries({queryKey:['tickets']})
  if(manager)await prepareNotification(saved,'reopen')
 }

 const markOutlookOpened=async()=>{
  if(!pendingNotification)return
  const {error}=await supabase.rpc('mark_ticket_notification_outlook_opened',{p_notification_id:pendingNotification.notificationId})
  if(error)notify('Ouverture Outlook non journalisée : '+error.message,'error')
  else{notify('Ouverture Outlook journalisée.','info');await qc.invalidateQueries({queryKey:['ticket-notifications',pendingNotification.ticketId]})}
 }

 const confirmNotification=async(confirmed:boolean)=>{
  if(!pendingNotification)return
  const {error}=await supabase.rpc('confirm_ticket_notification',{p_notification_id:pendingNotification.notificationId,p_confirmed:confirmed})
  if(error){notify(error.message,'error');return}
  notify(confirmed?'Notification confirmée comme envoyée à tous les destinataires.':'Notification marquée comme non envoyée.')
  const ticketId=pendingNotification.ticketId
  setPendingNotification(null)
  await qc.invalidateQueries({queryKey:['ticket-notifications',ticketId]})
 }

 const exportFiltered=async()=>{
  try{
   notify('Préparation de l’export détaillé…','info')
   const ids=rows.map(t=>t.id)
   const [commentsQ,historyQ,materialsQ,movementsQ,recipientsQ,notificationsQ]=ids.length?await Promise.all([
    supabase.from('ticket_comments').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('ticket_history').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('ticket_materials').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('inventory_movements').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('ticket_notification_recipients').select('*').in('ticket_id',ids).order('created_at'),
    supabase.from('ticket_notifications').select('*').in('ticket_id',ids).order('created_at')
   ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null}] as any
   for(const q of [commentsQ,historyQ,materialsQ,movementsQ,recipientsQ,notificationsQ])if(q.error)throw q.error

   const wb=XLSX.utils.book_new()
   addSheet(wb,'Tickets filtrés',rows.map(t=>({
    id:t.id,numero_ticket:t.ticket_number,titre:t.subject,demandeur:t.requester||'',client_id:t.customer_id||'',client:clientName(t.customer_id),
    customer_contact_id:t.customer_contact_id||'',description:t.description||'',categorie:t.category,type:t.intervention_type,statut:t.status,priorite:t.priority,
    technicien_id:t.assigned_to||'',technicien:techName(t.assigned_to),date_arrivee:excelDate(t.arrival_at),debut_planifie:excelDate(t.planned_start),
    fin_planifie:excelDate(t.planned_end),incident_bloquant:t.is_blocking?'Oui':'Non',incident_parent:t.parent_incident||'',
    incident_general:t.general_incident_label||'',commentaire_resolution:t.resolution_comment||'',closed_by:t.closed_by||'',
    cloture_le:excelDate(t.closed_at),cout_intervention:Number(t.intervention_cost||0),note_cout_intervention:t.intervention_cost_note||'',
    created_by:t.created_by||'',auteur_creation:techName(t.created_by),cree_le:excelDate(t.created_at),modifie_le:excelDate(t.updated_at)
   })))
   addSheet(wb,'Destinataires ticket',(recipientsQ.data||[]).map((r:any)=>({id:r.id,ticket_id:r.ticket_id,ticket:tickets.find(t=>t.id===r.ticket_id)?.ticket_number||'',email:r.email,ajoute_par:r.added_by||'',date:excelDate(r.created_at)})))
   addSheet(wb,'Notifications Outlook',(notificationsQ.data||[]).map((n:any)=>({id:n.id,ticket_id:n.ticket_id,ticket:tickets.find(t=>t.id===n.ticket_id)?.ticket_number||'',type:n.notification_type,objet:n.subject,message:n.body,destinataires:(n.recipients||[]).join('; '),acteur_id:n.actor_id||'',acteur:techName(n.actor_id),outlook_ouvert_le:excelDate(n.outlook_opened_at),confirmation:n.confirmation_status,confirme_le:excelDate(n.confirmed_at),cree_le:excelDate(n.created_at)})))
   addSheet(wb,'Commentaires',(commentsQ.data||[]).map((c:any)=>({id:c.id,ticket_id:c.ticket_id,ticket:tickets.find(t=>t.id===c.ticket_id)?.ticket_number||'',type_commentaire:c.comment_scope==='notification'?'Notification':'Interne',auteur_id:c.author_id,auteur:c.author_name||techName(c.author_id),commentaire:c.body,date:excelDate(c.created_at)})))
   addSheet(wb,'Historique',(historyQ.data||[]).map((h:any)=>({id:h.id,ticket_id:h.ticket_id,ticket:tickets.find(t=>t.id===h.ticket_id)?.ticket_number||'',acteur_id:h.actor_id||'',acteur:techName(h.actor_id),action:h.action,date:excelDate(h.created_at),details:JSON.stringify(h.details||{}),...Object.fromEntries(Object.entries(h.details||{}).map(([k,v])=>['detail_'+k,typeof v==='object'?JSON.stringify(v):v]))})))
   addSheet(wb,'Matériel ticket',(materialsQ.data||[]).map((m:any)=>({id:m.id,ticket_id:m.ticket_id,ticket:tickets.find(t=>t.id===m.ticket_id)?.ticket_number||'',catalog_id:m.catalog_id||'',libelle:m.label,quantite:m.quantity,note:m.note||'',date:excelDate(m.created_at)})))
   addSheet(wb,'Mouvements stock',(movementsQ.data||[]).map((m:any)=>({id:m.id,ticket_id:m.ticket_id||'',ticket:m.ticket_number_snapshot||tickets.find(t=>t.id===m.ticket_id)?.ticket_number||'',item_id:m.item_id,type:m.movement_type,quantite:m.quantity,prix_unitaire_snapshot:Number(m.unit_price_snapshot||0),cout_total_snapshot:Number(m.total_cost_snapshot||0),ancien_total:m.old_total,nouveau_total:m.new_total,allocation_id:m.allocation_id||'',beneficiaire:m.assignee||'',acteur_id:m.actor_id||'',acteur:techName(m.actor_id),motif:m.reason||'',note:m.note||'',date:excelDate(m.created_at)})))
   addSheet(wb,'Filtres',[{recherche:search||'',date_sur:dateField,du:from||'',au:to||'',technicien:technician?techName(technician):'Tous',demandeur:requester||'Tous',client:customer?clientName(customer):'Tous',statut:statusFilter||'Tous',priorite:priorityFilter||'Toutes',resultats:rows.length}])
   downloadWorkbook(wb,'PlanningSecuritas_Tickets_'+new Date().toISOString().slice(0,10)+'.xlsx')
   notify('Export détaillé des tickets téléchargé.')
  }catch(e:any){notify('Erreur export : '+(e?.message||'échec'),'error')}
 }

 return <div className="page tickets-page">
  <header className="page-head">
   <div><h1>Tickets</h1><p>{manager?'Vue équipe complète, filtres croisés, notifications Outlook et traçabilité.':'Tes tickets, notifications Outlook et traçabilité.'}</p></div>
   <div className="actions tickets-head-actions"><button className="secondary page-primary-action" onClick={()=>void exportFiltered()}><Download size={16}/> Export filtré</button><button className="primary page-primary-action" onClick={newTicket}><Plus size={16}/> Nouveau ticket</button></div>
  </header>

  <section className="card module-filter-card">
   <div className="module-filter-title"><Search size={16}/><b>Recherche & filtres</b><span>{rows.length} résultat{rows.length>1?'s':''}</span></div>
   <div className="module-filter-grid ticket-filter-grid">
    <label className="wide-filter">Recherche<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Numéro, titre, demandeur, client, technicien…"/></label>
    <label>Date sur<select value={dateField} onChange={e=>setDateField(e.target.value as DateField)}><option value="created_at">Création</option><option value="arrival_at">Arrivée</option><option value="planned_start">Planifiée</option><option value="closed_at">Clôture</option></select></label>
    <label>Du<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
    <label>Au<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
    {manager&&<label>Technicien<select value={technician} onChange={e=>setTechnician(e.target.value)}><option value="">Tous</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}{p.active?'':' (inactif)'}</option>)}</select></label>}
    <label>Demandeur<select value={requester} onChange={e=>setRequester(e.target.value)}><option value="">Tous</option>{requesters.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
    <label>Client<select value={customer} onChange={e=>setCustomer(e.target.value)}><option value="">Tous</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' (inactif)'}</option>)}</select></label>
    <label>Statut<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">Tous</option>{cfg('status').map((x:any)=><option key={x.id} value={x.label}>{x.label}</option>)}</select></label>
    <label>Priorité<select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}><option value="">Toutes</option>{cfg('priority').map((x:any)=><option key={x.id} value={x.label}>{x.label}</option>)}</select></label>
    <button className="ghost filter-clear" onClick={clearFilters}>Effacer les filtres</button>
   </div>
  </section>

  <div className="table-wrap desktop-only"><table><thead><tr><th>Ticket</th><th>Demandeur</th><th>Client</th><th>Statut</th><th>Priorité</th><th>Technicien</th><th>Créé</th><th>Planifié</th></tr></thead><tbody>{rows.map(t=><tr key={t.id} className="clickable-row" onClick={()=>openTicket(t)}><td><b>{t.ticket_number}</b><br/><small>{t.subject}</small></td><td>{t.requester||'—'}</td><td>{clientName(t.customer_id)}</td><td><span className="badge">{t.status}</span></td><td>{t.priority}</td><td>{techName(t.assigned_to)}</td><td>{excelDate(t.created_at)}</td><td>{excelDate(t.planned_start)||'—'}</td></tr>)}</tbody></table></div>
  <div className="module-mobile-list">{rows.map(t=><article className="module-mobile-card clickable-row" key={t.id} onClick={()=>openTicket(t)}><div className="module-mobile-head"><div><b>{t.ticket_number} • {t.subject}</b><small>{clientName(t.customer_id)} • {t.requester||'Sans demandeur'}</small></div><span className="badge">{t.status}</span></div><div className="module-mobile-meta"><div><span>Priorité</span><b>{t.priority}</b></div><div><span>Technicien</span><b>{techName(t.assigned_to)}</b></div><div><span>Créé</span><b>{new Date(t.created_at).toLocaleDateString('fr-FR')}</b></div><div><span>Planifié</span><b>{t.planned_start?new Date(t.planned_start).toLocaleString('fr-FR'):'—'}</b></div></div></article>)}</div>

  {selected&&<DetailDrawer title={selected.id?selected.ticket_number||'Ticket':'Nouveau ticket'} subtitle={selected.id?'Détail complet du ticket':'Création'} onClose={()=>setSelected(null)}>
   {selected.id&&<div className="detail-summary-grid"><div><span>Demandeur</span><b>{selected.requester||'—'}</b></div><div><span>Client</span><b>{clientName(selected.customer_id)}</b></div><div><span>Technicien</span><b>{techName(selected.assigned_to)}</b></div><div><span>Statut</span><b>{selected.status||'—'}</b></div><div><span>Créé</span><b>{excelDate(selected.created_at)||'—'}</b></div><div><span>Modifié</span><b>{excelDate(selected.updated_at)||'—'}</b></div><div><span>Arrivée</span><b>{excelDate(selected.arrival_at)||'—'}</b></div><div><span>Clôture</span><b>{excelDate(selected.closed_at)||'—'}</b></div></div>}
   {manager&&selected.id&&<section className="ticket-cost-summary"><div><span>Coût intervention</span><b>{money(selectedInterventionCost)}</b></div><div><span>Coût matériel utilisé</span><b>{money(selectedMaterialCost)}</b></div><div className="total"><span>Coût total</span><b>{money(selectedTotalCost)}</b></div>{selected.intervention_cost_note&&<small>{selected.intervention_cost_note}</small>}</section>}

   <form className="form-grid" onSubmit={save} key={selected.id||'new-ticket'}>
    <label className="full">Titre<input name="subject" defaultValue={selected.subject||''} required/></label>
    <label>Demandeur<input name="requester" defaultValue={selected.requester||''}/></label>
    <label>Client<select name="customer_id" defaultValue={selected.customer_id||''} onChange={e=>setDraftCustomerId(e.target.value)}><option value="">— Aucun —</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>

    {manager&&<>    <div className="full ticket-recipient-editor">
     <div className="ticket-recipient-head"><div><Mail size={16}/><b>Notifications Outlook</b></div><span>{recipientEmails.length} contact{recipientEmails.length>1?'s':''} ticket</span></div>
     <div className="distribution-summary"><span>Liste de distribution globale</span>{distribution.length?distribution.map((x:any)=><b key={x.id}>{x.name?x.name+' • ':''}{x.email}</b>):<small>Aucun destinataire global configuré dans Configuration.</small>}</div>
     <div className="recipient-chips">{recipientEmails.map(email=><span className="recipient-chip" key={email}>{email}<button type="button" onClick={()=>removeRecipient(email)} aria-label={'Retirer '+email}><Trash2 size={12}/></button></span>)}</div>
     <div className="recipient-add-row"><input type="email" value={recipientInput} onChange={e=>setRecipientInput(e.target.value)} placeholder="mail@domaine.com" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addRecipient()}}}/><button type="button" className="secondary" onClick={()=>addRecipient()} ><UserPlus size={14}/> Ajouter</button></div>
     {customerSuggestions.length>0&&<div className="recipient-suggestions"><span>Contacts du client</span><div>{customerSuggestions.map(x=><button type="button" className="ghost small" key={x.email} onClick={()=>addRecipient(x.email)}>{x.label}<small>{x.email}</small></button>)}</div></div>}
     <small className="muted">À chaque création, mise à jour, clôture ou réouverture, Outlook préparera un message pour la liste globale + ces contacts.</small>
    </div></>}

    <label>Catégorie<select name="category" defaultValue={selected.category||''}>{cfg('category').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Type<select name="type" defaultValue={selected.intervention_type||''}>{cfg('type').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Statut<select name="status" defaultValue={selected.status||''}>{cfg('status').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Priorité<select name="priority" defaultValue={selected.priority||''}>{cfg('priority').map((x:any)=><option key={x.id}>{x.label}</option>)}</select></label>
    <label>Technicien<select name="assigned_to" defaultValue={selected.assigned_to||''} disabled={!manager}><option value="">Non affecté</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select></label>
    <label>Incident parent<input name="parent_incident" defaultValue={selected.parent_incident||''}/></label>
    <label>Incident général<input name="general_incident_label" defaultValue={selected.general_incident_label||''}/></label>
    <label>Début planifié<input name="planned_start" type="datetime-local" defaultValue={selected.planned_start?selected.planned_start.slice(0,16):''}/></label>
    <label>Fin planifiée<input name="planned_end" type="datetime-local" defaultValue={selected.planned_end?selected.planned_end.slice(0,16):''}/></label>
    {manager&&<><label>Coût intervention (€)<input name="intervention_cost" type="number" min="0" step="0.01" defaultValue={Number(selected.intervention_cost||0)}/></label><label>Note coût<input name="intervention_cost_note" defaultValue={selected.intervention_cost_note||''} placeholder="Main-d’œuvre, déplacement, prestation…"/></label></>}
    <label className="full"><span><input name="blocking" type="checkbox" defaultChecked={selected.is_blocking}/> Incident bloquant</span></label>
    <label className="full">Description<textarea name="description" defaultValue={selected.description||''}/></label>
    <button className="primary full"><Save size={15}/> Enregistrer</button>
   </form>

   {selected.id&&<>
    <div className="actions ticket-detail-actions"><button className="primary" onClick={openClosure} disabled={!!selected.closed_at}><CheckCircle2 size={15}/> Clôturer</button>{selected.closed_at&&<button className="ghost" onClick={()=>void reopen()}><RotateCcw size={15}/> Rouvrir</button>}</div>
    {selected.resolution_comment&&<div className="detail-description"><b>Résolution :</b> {selected.resolution_comment}</div>}

    <section className="ticket-comment-composer">
     <div className="ticket-comment-composer-head"><div><MessageSquarePlus size={16}/><b>Ajouter un commentaire</b></div><span>{commentText.length} caractère{commentText.length>1?'s':''}</span></div>
     <textarea value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Saisis ici le compte rendu, les actions réalisées, le constat ou les informations à transmettre…" rows={7}/>
     <div className="ticket-comment-actions">{manager&&<button className="ghost" onClick={()=>setCommunicationTarget('comment')}><MessageSquareText size={15}/> Communication</button>}<button className="secondary ticket-comment-submit internal" onClick={()=>void addComment('internal')} disabled={commentBusy||!commentText.trim()}><MessageSquarePlus size={15}/>{commentBusy?' Enregistrement…':' Commentaire interne'}</button>{manager&&<button className="primary ticket-comment-submit notification" onClick={()=>void addComment('notification')} disabled={commentBusy||!commentText.trim()}><Mail size={15}/>{commentBusy?' Enregistrement…':' Commentaire notification'}</button>}</div>
    </section>

    {manager&&<div className="ticket-manager-only-section">
    <h3 className="section-title"><Mail size={15}/> Notifications Outlook ({ticketNotifications.length})</h3>
    <div className="planning-history-list">{ticketNotifications.length===0&&<span className="muted">Aucune notification enregistrée.</span>}{ticketNotifications.map((n:any)=><details className="compact-history" key={n.id}><summary><b>{n.notification_type} • {n.confirmation_status==='confirmed'?'Envoyée':n.confirmation_status==='pending'?'À confirmer':'Non envoyée'}</b><small>{excelDate(n.created_at)} • {techName(n.actor_id)}</small></summary><div className="notification-history-detail"><b>{n.subject}</b><span>Destinataires : {(n.recipients||[]).join('; ')||'Aucun'}</span><span>Outlook ouvert : {n.outlook_opened_at?excelDate(n.outlook_opened_at):'Non tracé'}</span><pre>{n.body}</pre></div></details>)}</div>
    </div>}

    <h3 className="section-title"><MessageSquarePlus size={15}/> Commentaires ({comments.length})</h3>
    <div className="planning-history-list">{comments.length===0&&<span className="muted">Aucun commentaire.</span>}{comments.map((c:any)=><div className="planning-comment-row" key={c.id}><div className="comment-row-head"><b>{c.author_name||techName(c.author_id)}</b><span className={'badge '+(c.comment_scope==='notification'?'green':'')}>{c.comment_scope==='notification'?'Notification':'Interne'}</span></div><small>{excelDate(c.created_at)}</small><p>{c.body}</p></div>)}</div>

    <h3 className="section-title"><History size={15}/> Historique ({history.length})</h3>
    <div className="planning-history-list">{history.length===0&&<span className="muted">Aucun historique.</span>}{history.map((h:any)=><details className="compact-history" key={h.id}><summary><b>{h.action}</b><small>{excelDate(h.created_at)} • {techName(h.actor_id)}</small></summary><pre>{JSON.stringify(h.details||{},null,2)}</pre></details>)}</div>

    <h3 className="section-title"><Package size={15}/> Matériel & stock</h3>

    {manager&&<div className="ticket-manager-only-section">
    <section className="ticket-material-editor">
     <div className="ticket-material-editor-head"><div><Package size={16}/><b>{editingMaterialId?'Corriger un matériel':'Ajouter du matériel'}</b></div>{editingMaterialId&&<button className="ghost small" onClick={resetMaterialEditor}>Annuler correction</button>}</div>
     <div className="ticket-material-form">
      <label className="wide-filter">Matériel<input list="ticket-material-catalog" value={materialLabel} onChange={e=>setMaterialLabel(e.target.value)} placeholder="ex: Caméra, alimentation, switch, câble…"/><datalist id="ticket-material-catalog">{materialsCatalog.map((m:any)=><option key={m.id} value={m.label}/>)}</datalist></label>
      <label>Quantité<input type="number" min="1" value={materialQty} onChange={e=>setMaterialQty(Math.max(1,Number(e.target.value)||1))}/></label>
      <label className="wide-filter">Note<input value={materialNote} onChange={e=>setMaterialNote(e.target.value)} placeholder="Modèle, emplacement, n° série, précision…"/></label>
      <button className="secondary" onClick={()=>void saveMaterial()} disabled={materialBusy}><Save size={14}/>{editingMaterialId?' Corriger':' Ajouter'}</button>
     </div>
    </section>

    <section className="ticket-stock-use">
     <div className="ticket-material-editor-head"><div><Package size={16}/><b>Utiliser du stock pour l’intervention</b></div></div>
     <div className="ticket-material-form">
      <label className="wide-filter">Référence inventaire<select value={stockItemId} onChange={e=>setStockItemId(e.target.value)}><option value="">— Choisir —</option>{inventoryItems.map(i=><option key={i.id} value={i.id}>{[i.category,i.manufacturer,i.model,i.reference].filter(Boolean).join(' • ')} — dispo {i.quantity_total-i.quantity_reserved-i.quantity_assigned}</option>)}</select></label>
      <label>Quantité<input type="number" min="1" value={stockQty} onChange={e=>setStockQty(Math.max(1,Number(e.target.value)||1))}/></label>
      <label className="wide-filter">Motif obligatoire<input value={stockReason} onChange={e=>setStockReason(e.target.value)} placeholder="Remplacement caméra HS, installation switch, alimentation remplacée…"/></label>
      <button className="primary" onClick={()=>void useStockMaterial()} disabled={materialBusy||!stockItemId}><Package size={14}/> Sortir & lier</button>
     </div>
    </section>
    </div>}

    <div className="planning-history-list">
     {materials.map((m:any)=><div className="planning-stock-row ticket-material-row" key={'mat-'+m.id}><div><b>{m.label} × {m.quantity}</b><small>{excelDate(m.created_at)} • {m.note||'Sans note'}</small></div>{manager&&<div className="actions"><button className="ghost small" onClick={()=>startEditMaterial(m)}>Corriger</button><button className="danger small" onClick={()=>void removeMaterial(m)}><Trash2 size={13}/></button></div>}</div>)}
     {movements.map((m:any)=><details className="compact-history" key={'mov-'+m.id}><summary><b>{m.movement_type} × {m.quantity}</b><small>{excelDate(m.created_at)} • {m.reason||'Sans motif'}</small></summary><div className="detail-key-values"><div><span>Stock</span><b>{m.old_total??'—'} → {m.new_total??'—'}</b></div><div><span>Bénéficiaire</span><b>{m.assignee||'—'}</b></div><div><span>Acteur</span><b>{techName(m.actor_id)}</b></div><div><span>Note</span><b>{m.note||'—'}</b></div></div></details>)}
     {materials.length===0&&movements.length===0&&<span className="muted">Aucun matériel lié.</span>}
    </div>
   </>}
  </DetailDrawer>}

  {closureOpen&&selected?.id&&<TicketClosureDialog ticketNumber={selected.ticket_number||'Ticket'} value={closureText} onChange={setClosureText} onCommunication={manager?()=>setCommunicationTarget('closure'):undefined} onClose={()=>setClosureOpen(false)} onSubmit={close} busy={closureBusy}/>}
  {manager&&communicationTarget&&selected?.id&&<TicketCommunicationPicker templates={communicationTemplates} target={communicationTarget} onClose={()=>setCommunicationTarget(null)} onInsert={template=>void insertCommunication(template)} onCopy={template=>void copyCommunication(template)} onMail={template=>void mailCommunication(template)}/>}
  {manager&&pendingNotification&&<TicketNotificationDialog notification={pendingNotification} onOpenOutlook={markOutlookOpened} onConfirm={confirmNotification}/>}
 </div>
}
