export type Role='manager'|'technician'

export interface Profile{
 id:string; email:string|null; display_name:string; role:Role; active:boolean;
 work_start:string; work_end:string; created_at:string;
 force_password_change?:boolean; last_login_at?:string|null;
}

export interface Ticket{
 id:string; ticket_number:string; subject:string; requester:string|null; description:string|null;
 category:string; intervention_type:string; status:string; priority:string; assigned_to:string|null;
 arrival_at:string; planned_start:string|null; planned_end:string|null; is_blocking:boolean;
 parent_incident:string|null; general_incident_label:string|null; resolution_comment:string|null;
 closed_at:string|null; closed_by?:string|null; created_by:string|null; created_at:string; updated_at:string;
 customer_id?:string|null; customer_contact_id?:string|null;
}

export interface Customer{
 id:string; code:string|null; name:string; type:'company'|'person'; email:string|null; phone:string|null;
 address:string|null; city:string|null; postal_code:string|null; country:string|null; notes:string|null;
 active:boolean; created_at:string; updated_at:string;
}

export interface CustomerContact{
 id:string; customer_id:string; first_name:string; last_name:string; email:string|null; phone:string|null;
 job_title:string|null; active:boolean; created_at:string;
}

export interface InventoryItem{
 id:string; category:string; manufacturer:string|null; model:string; reference:string|null; description:string|null;
 unit_price:number; quantity_total:number; quantity_reserved:number; quantity_assigned:number; stock_minimum:number;
 location:string|null; tracked_individually:boolean; active:boolean; created_at:string; updated_at:string;
}

export const inventoryAvailable=(i:InventoryItem)=>i.quantity_total-i.quantity_reserved-i.quantity_assigned


export interface InventoryMovement{
 id:number; item_id:string; movement_type:string; quantity:number; old_total:number|null; new_total:number|null;
 ticket_id:string|null; ticket_number_snapshot:string|null; allocation_id:string|null; assignee:string|null;
 actor_id:string|null; note:string|null; reason:string; created_at:string;
}

export interface CommunicationTemplate{
 id:string; theme:string; channel:'Outlook'|'Teams'|'ServiceNow'|'OneNote'|'Divers'|'PIM / Accès';
 title:string; subject:string|null; body:string; scope:'team'|'personal'; owner_id:string|null;
 is_system:boolean; active:boolean; sort_order:number; created_by:string|null; created_at:string; updated_at:string;
}
