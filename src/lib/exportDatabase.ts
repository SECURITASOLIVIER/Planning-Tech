import * as XLSX from 'xlsx'
import { supabase } from './supabase'
import { downloadWorkbook } from './excel'

const NULL_TOKEN='__NULL__'
const JSON_PREFIX='__JSON__:'
const FETCH_BATCH=1000
const DATA_ROWS_PER_SHEET=100000

type ColumnMeta={
 column_name:string
 ordinal_position:number
 data_type:string
 udt_name:string
 is_nullable:'YES'|'NO'
 column_default:string|null
}
type TableMeta={table_name:string;columns:ColumnMeta[]}
type ForeignKeyMeta={constraint_name:string;table_name:string;column_name:string;referenced_table:string;referenced_column:string}
type PrimaryKeyMeta={table_name:string;constraint_name:string;columns:string[]}
type DatabaseMetadata={
 schema:string
 format_version:number
 tables:TableMeta[]
 primary_keys:PrimaryKeyMeta[]
 foreign_keys:ForeignKeyMeta[]
}

function normalizeCell(value:unknown){
 if(value===null||value===undefined)return NULL_TOKEN
 if(typeof value==='bigint')return value.toString()
 if(typeof value==='object')return JSON_PREFIX+JSON.stringify(value)
 return value
}

function safeBaseName(value:string){
 return value.replace(/[:\\/?*\[\]]/g,'_').replace(/\s+/g,'_')
}

function makeDataSheetName(order:number,table:string,chunkIndex:number,totalChunks:number){
 const prefix='T'+String(order).padStart(2,'0')+'_'
 const suffix=totalChunks>1?'_'+String(chunkIndex).padStart(2,'0'):''
 const maxBase=31-prefix.length-suffix.length
 return (prefix+safeBaseName(table).slice(0,Math.max(1,maxBase))+suffix).slice(0,31)
}

function computeRestoreOrder(tableNames:string[],foreignKeys:ForeignKeyMeta[]){
 const tables=new Set(tableNames)
 const deps=new Map<string,Set<string>>()
 const children=new Map<string,Set<string>>()
 for(const t of tableNames){deps.set(t,new Set());children.set(t,new Set())}
 for(const fk of foreignKeys){
  if(!tables.has(fk.table_name)||!tables.has(fk.referenced_table)||fk.table_name===fk.referenced_table)continue
  deps.get(fk.table_name)!.add(fk.referenced_table)
  children.get(fk.referenced_table)!.add(fk.table_name)
 }
 const queue=tableNames.filter(t=>deps.get(t)!.size===0).sort()
 const result:string[]=[]
 while(queue.length){
  const t=queue.shift()!
  result.push(t)
  for(const child of [...children.get(t)!].sort()){
   const d=deps.get(child)!
   d.delete(t)
   if(d.size===0&&!result.includes(child)&&!queue.includes(child)){queue.push(child);queue.sort()}
  }
 }
 for(const t of [...tableNames].sort())if(!result.includes(t))result.push(t)
 return result
}

async function fetchAllRows(table:string){
 const rows:any[]=[]
 let from=0
 while(true){
  const {data,error}=await (supabase as any).from(table).select('*').range(from,from+FETCH_BATCH-1)
  if(error)throw new Error(table+' : '+error.message)
  const batch=(data||[]) as any[]
  rows.push(...batch)
  if(batch.length<FETCH_BATCH)break
  from+=FETCH_BATCH
 }
 return rows
}

function addAoaSheet(wb:XLSX.WorkBook,name:string,rows:unknown[][],widths?:number[]){
 const ws=XLSX.utils.aoa_to_sheet(rows)
 if(widths)ws['!cols']=widths.map(w=>({wch:w}))
 XLSX.utils.book_append_sheet(wb,ws,name)
}

export async function exportCompleteBusinessDatabase(){
 const {data:metadataRaw,error:metadataError}=await supabase.rpc('database_export_metadata')
 if(metadataError)throw new Error('Métadonnées BDD : '+metadataError.message)

 const metadata=metadataRaw as DatabaseMetadata
 const tableMap=new Map((metadata.tables||[]).map(t=>[t.table_name,t]))
 const tableNames=(metadata.tables||[]).map(t=>t.table_name)
 const restoreOrder=computeRestoreOrder(tableNames,metadata.foreign_keys||[])
 const pkMap=new Map((metadata.primary_keys||[]).map(pk=>[pk.table_name,pk.columns||[]]))

 const wb=XLSX.utils.book_new()
 wb.Props={
  Title:'Planning Securitas - Sauvegarde BDD complète',
  Subject:'Export complet des tables métier pour réintégration',
  Author:'Planning Securitas',
  CreatedDate:new Date()
 }

 const counts:Record<string,number>=Object.create(null)
 const tableManifest:any[]=[]
 const columnManifest:any[]=[]
 const exportedAt=new Date().toISOString()
 let totalRows=0

 for(const [index,table] of restoreOrder.entries()){
  const meta=tableMap.get(table)
  if(!meta)continue
  const columns=[...(meta.columns||[])].sort((a,b)=>a.ordinal_position-b.ordinal_position)
  const columnNames=columns.map(c=>c.column_name)
  const rows=await fetchAllRows(table)
  counts[table]=rows.length
  totalRows+=rows.length

  for(const col of columns){
   columnManifest.push({
    restore_order:index+1,
    table_name:table,
    column_name:col.column_name,
    ordinal_position:col.ordinal_position,
    data_type:col.data_type,
    udt_name:col.udt_name,
    nullable:col.is_nullable,
    column_default:col.column_default??NULL_TOKEN,
    primary_key:(pkMap.get(table)||[]).includes(col.column_name)?'YES':'NO'
   })
  }

  const chunkCount=Math.max(1,Math.ceil(rows.length/DATA_ROWS_PER_SHEET))
  const sheetNames:string[]=[]
  for(let chunkIndex=1;chunkIndex<=chunkCount;chunkIndex++){
   const start=(chunkIndex-1)*DATA_ROWS_PER_SHEET
   const chunk=rows.slice(start,start+DATA_ROWS_PER_SHEET)
   const sheetName=makeDataSheetName(index+1,table,chunkIndex,chunkCount)
   sheetNames.push(sheetName)
   const matrix:unknown[][]=[columnNames]
   for(const row of chunk)matrix.push(columnNames.map(col=>normalizeCell(row[col])))
   addAoaSheet(wb,sheetName,matrix,columnNames.map(c=>Math.min(36,Math.max(12,c.length+2))))
  }

  tableManifest.push({
   restore_order:index+1,
   schema:'public',
   table_name:table,
   row_count:rows.length,
   column_count:columnNames.length,
   primary_key:(pkMap.get(table)||[]).join(','),
   sheet_names:sheetNames.join(','),
   chunks:chunkCount
  })
 }

 const manifestRows:unknown[][]=[
  ['PLANNING SECURITAS - SAUVEGARDE BDD COMPLÈTE'],
  ['format','planning-securitas-xlsx-backup'],
  ['format_version',metadata.format_version||2],
  ['exported_at',exportedAt],
  ['schema','public'],
  ['tables',restoreOrder.length],
  ['total_rows',totalRows],
  ['null_token',NULL_TOKEN],
  ['json_prefix',JSON_PREFIX],
  ['restore_rule','Réimporter les tables selon restore_order. Les ID et clés étrangères doivent être conservés.'],
  ['security_exclusions','Auth passwords; service_role; JWT secrets; database password; Edge Function secrets'],
  ['warning','Ce classeur contient des données métier potentiellement personnelles. À protéger comme une sauvegarde de production.'],
  [],
  ['RESTORE_ORDER','TABLE','ROWS','SHEETS']
 ]
 for(const t of tableManifest)manifestRows.push([t.restore_order,t.table_name,t.row_count,t.sheet_names])
 addAoaSheet(wb,'MANIFEST',manifestRows,[18,34,14,48])

 addAoaSheet(
  wb,
  'TABLES',
  [
   ['restore_order','schema','table_name','row_count','column_count','primary_key','sheet_names','chunks'],
   ...tableManifest.map(t=>[t.restore_order,t.schema,t.table_name,t.row_count,t.column_count,t.primary_key,t.sheet_names,t.chunks])
  ],
  [14,12,34,14,14,24,48,10]
 )

 addAoaSheet(
  wb,
  'COLUMNS',
  [
   ['restore_order','table_name','column_name','ordinal_position','data_type','udt_name','nullable','column_default','primary_key'],
   ...columnManifest.map(c=>[c.restore_order,c.table_name,c.column_name,c.ordinal_position,c.data_type,c.udt_name,c.nullable,c.column_default,c.primary_key])
  ],
  [14,30,30,14,22,20,10,38,12]
 )

 addAoaSheet(
  wb,
  'FOREIGN_KEYS',
  [
   ['constraint_name','table_name','column_name','referenced_table','referenced_column'],
   ...(metadata.foreign_keys||[]).map(fk=>[fk.constraint_name,fk.table_name,fk.column_name,fk.referenced_table,fk.referenced_column])
  ],
  [34,30,28,30,28]
 )

 const stamp=exportedAt.replaceAll(':','-').slice(0,19)
 downloadWorkbook(wb,'PlanningSecuritas_BDD_Complete_'+stamp+'.xlsx')
 return counts
}


export async function runCompleteBusinessBackup(){
 const counts=await exportCompleteBusinessDatabase()
 const {error}=await supabase.rpc('log_app_action',{
  p_action:'database_business_backup_exported',
  p_target_type:'database',
  p_target_id:null,
  p_details:{tables:Object.keys(counts).length,row_counts:counts}
 })
 if(error)throw new Error('Journal sauvegarde : '+error.message)
 return counts
}
