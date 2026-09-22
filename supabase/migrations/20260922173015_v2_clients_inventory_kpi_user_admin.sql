-- Super Support IT V2
-- Applied to Supabase as migration 20260922173015_v2_clients_inventory_kpi_user_admin.

create schema if not exists private;

alter table public.profiles
  add column if not exists force_password_change boolean not null default false,
  add column if not exists last_login_at timestamptz;

alter table public.config_values add column if not exists code text;
update public.config_values set code = case
  when kind='status' and label='Nouveau' then 'new'
  when kind='status' and label='Planifié' then 'planned'
  when kind='status' and label='En cours' then 'in_progress'
  when kind='status' and label='En attente' then 'waiting'
  when kind='status' and label='Clôturé' then 'closed'
  when kind='status' and label='Annulé' then 'cancelled'
  when kind='priority' and label='Basse' then 'low'
  when kind='priority' and label='Normale' then 'normal'
  when kind='priority' and label='Haute' then 'high'
  when kind='priority' and label='Urgente' then 'urgent'
  else coalesce(code,kind||'_'||substr(id::text,1,8))
end where code is null;
alter table public.config_values alter column code set not null;
create unique index if not exists uq_config_values_kind_code on public.config_values(kind,code);

create table if not exists public.customers(
 id uuid primary key default gen_random_uuid(),
 code text unique,
 name text not null,
 type text not null default 'company' check(type in ('company','person')),
 email text,phone text,address text,city text,postal_code text,country text default 'France',notes text,
 active boolean not null default true,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.customer_contacts(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.customers(id) on delete cascade,
 first_name text not null,last_name text not null,email text,phone text,job_title text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

alter table public.tickets
 add column if not exists customer_id uuid references public.customers(id) on delete set null,
 add column if not exists customer_contact_id uuid references public.customer_contacts(id) on delete set null,
 add column if not exists closed_by uuid references public.profiles(id) on delete set null;

create table if not exists public.inventory_items(
 id uuid primary key default gen_random_uuid(),
 category text not null,
 manufacturer text,
 model text not null,
 reference text,
 description text,
 unit_price numeric(12,2) not null default 0 check(unit_price>=0),
 quantity_total integer not null default 0 check(quantity_total>=0),
 quantity_reserved integer not null default 0 check(quantity_reserved>=0),
 quantity_assigned integer not null default 0 check(quantity_assigned>=0),
 stock_minimum integer not null default 0 check(stock_minimum>=0),
 location text,
 tracked_individually boolean not null default false,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(quantity_reserved+quantity_assigned<=quantity_total)
);

create table if not exists public.inventory_assets(
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 serial_number text unique,
 asset_tag text unique,
 status text not null default 'available' check(status in ('available','reserved','assigned','broken','lost','retired')),
 assigned_to_text text,
 purchase_date date,
 warranty_end date,
 purchase_price numeric(12,2) check(purchase_price is null or purchase_price>=0),
 ticket_id uuid references public.tickets(id) on delete set null,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.inventory_allocations(
 id uuid primary key default gen_random_uuid(),
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 ticket_id uuid references public.tickets(id) on delete set null,
 quantity integer not null check(quantity>0),
 status text not null check(status in ('reserved','assigned','returned','cancelled')),
 assigned_to_text text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements(
 id bigint generated always as identity primary key,
 item_id uuid not null references public.inventory_items(id) on delete restrict,
 movement_type text not null,
 quantity integer not null check(quantity>0),
 old_total integer,new_total integer,
 ticket_id uuid references public.tickets(id) on delete set null,
 allocation_id uuid references public.inventory_allocations(id) on delete set null,
 assignee text,
 actor_id uuid references public.profiles(id) on delete set null,
 note text,
 created_at timestamptz not null default now()
);

create table if not exists public.audit_events(
 id bigint generated always as identity primary key,
 actor_id uuid references public.profiles(id) on delete set null,
 actor_name text,
 action text not null,
 target_type text not null,
 target_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

alter table public.ticket_comments alter column author_id drop not null;
alter table public.ticket_comments drop constraint if exists ticket_comments_author_id_fkey;
alter table public.ticket_comments add constraint ticket_comments_author_id_fkey foreign key(author_id) references public.profiles(id) on delete set null;
alter table public.ticket_history drop constraint if exists ticket_history_actor_id_fkey;
alter table public.ticket_history add constraint ticket_history_actor_id_fkey foreign key(actor_id) references public.profiles(id) on delete set null;
alter table public.tickets drop constraint if exists tickets_created_by_fkey;
alter table public.tickets add constraint tickets_created_by_fkey foreign key(created_by) references public.profiles(id) on delete set null;
alter table public.tickets drop constraint if exists tickets_assigned_to_fkey;
alter table public.tickets add constraint tickets_assigned_to_fkey foreign key(assigned_to) references public.profiles(id) on delete set null;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,email,display_name,role)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'display_name',split_part(coalesce(new.email,'Utilisateur'),'@',1)),'technician')
 on conflict(id) do nothing;
 return new;
end $$;

create or replace function private.protect_manager_accounts()
returns trigger language plpgsql security definer set search_path=public as $$
declare active_managers integer;
begin
 if tg_op='DELETE' then
  if old.role='manager' and old.active then
   select count(*) into active_managers from public.profiles where role='manager' and active=true;
   if active_managers<=1 then raise exception 'Impossible de supprimer le dernier Manager actif'; end if;
  end if;
  return old;
 end if;
 if old.id=(select auth.uid()) and old.active=true and new.active=false then
  raise exception 'Tu ne peux pas désactiver ton propre compte';
 end if;
 if old.role='manager' and old.active=true and (new.role<>'manager' or new.active=false) then
  select count(*) into active_managers from public.profiles where role='manager' and active=true;
  if active_managers<=1 then raise exception 'Impossible de désactiver ou rétrograder le dernier Manager actif'; end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_protect_manager_accounts on public.profiles;
create trigger trg_protect_manager_accounts before update or delete on public.profiles
for each row execute function private.protect_manager_accounts();

create or replace function private.enforce_ticket_update_fields()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not private.is_manager() then
  if old.assigned_to is distinct from (select auth.uid()) then raise exception 'Ticket non affecté à ce technicien'; end if;
  if new.ticket_number is distinct from old.ticket_number
   or new.subject is distinct from old.subject
   or new.requester is distinct from old.requester
   or new.category is distinct from old.category
   or new.intervention_type is distinct from old.intervention_type
   or new.priority is distinct from old.priority
   or new.assigned_to is distinct from old.assigned_to
   or new.arrival_at is distinct from old.arrival_at
   or new.created_by is distinct from old.created_by
   or new.created_at is distinct from old.created_at
   or new.customer_id is distinct from old.customer_id
   or new.customer_contact_id is distinct from old.customer_contact_id
  then raise exception 'Champ non modifiable par un Technicien';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists trg_enforce_ticket_update_fields on public.tickets;
create trigger trg_enforce_ticket_update_fields before update on public.tickets
for each row execute function private.enforce_ticket_update_fields();

create or replace function private.touch_customer()
returns trigger language plpgsql security definer set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_touch_customer on public.customers;
create trigger trg_touch_customer before update on public.customers for each row execute function private.touch_customer();

create or replace function private.touch_inventory()
returns trigger language plpgsql security definer set search_path=public as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_touch_inventory on public.inventory_items;
create trigger trg_touch_inventory before update on public.inventory_items for each row execute function private.touch_inventory();

create or replace function public.record_login()
returns void language plpgsql security definer set search_path=public as $$
begin update public.profiles set last_login_at=now() where id=(select auth.uid()); end $$;

create or replace function public.complete_password_change()
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.profiles set force_password_change=false where id=(select auth.uid());
 insert into public.audit_events(actor_id,actor_name,action,target_type,target_id)
 select id,display_name,'password_changed','profile',id::text from public.profiles where id=(select auth.uid());
end $$;

create or replace function public.close_ticket(p_ticket_id uuid,p_resolution text)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid=(select auth.uid()); closed_label text; t public.tickets%rowtype; actor text;
begin
 if not private.is_active_user() then raise exception 'Compte inactif'; end if;
 select * into t from public.tickets where id=p_ticket_id for update;
 if not found then raise exception 'Ticket introuvable'; end if;
 if not private.is_manager() and t.assigned_to is distinct from uid then raise exception 'Accès refusé'; end if;
 if nullif(trim(coalesce(p_resolution,'')),'') is null then raise exception 'Résolution obligatoire'; end if;
 select label into closed_label from public.config_values where kind='status' and code='closed' limit 1;
 closed_label:=coalesce(closed_label,'Clôturé');
 update public.tickets set status=closed_label,resolution_comment=trim(p_resolution),closed_at=now(),closed_by=uid where id=p_ticket_id;
 insert into public.ticket_comments(ticket_id,author_id,body) values(p_ticket_id,uid,'Résolution : '||trim(p_resolution));
 select display_name into actor from public.profiles where id=uid;
 insert into public.audit_events(actor_id,actor_name,action,target_type,target_id,details)
 values(uid,actor,'ticket_closed','ticket',p_ticket_id::text,jsonb_build_object('resolution',trim(p_resolution)));
end $$;

create or replace function public.reopen_ticket(p_ticket_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid=(select auth.uid()); open_label text; t public.tickets%rowtype; actor text;
begin
 if not private.is_active_user() then raise exception 'Compte inactif'; end if;
 select * into t from public.tickets where id=p_ticket_id for update;
 if not found then raise exception 'Ticket introuvable'; end if;
 if not private.is_manager() and t.assigned_to is distinct from uid then raise exception 'Accès refusé'; end if;
 select label into open_label from public.config_values where kind='status' and code='in_progress' limit 1;
 open_label:=coalesce(open_label,'En cours');
 update public.tickets set status=open_label,closed_at=null,closed_by=null where id=p_ticket_id;
 select display_name into actor from public.profiles where id=uid;
 insert into public.audit_events(actor_id,actor_name,action,target_type,target_id)
 values(uid,actor,'ticket_reopened','ticket',p_ticket_id::text);
end $$;

create or replace function public.inventory_move(p_item_id uuid,p_type text,p_quantity integer,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare i public.inventory_items%rowtype; uid uuid=(select auth.uid()); oldq integer; newq integer; actor text;
begin
 if not private.is_manager() then raise exception 'Accès Manager requis'; end if;
 if p_quantity<=0 then raise exception 'Quantité invalide'; end if;
 select * into i from public.inventory_items where id=p_item_id for update;
 if not found then raise exception 'Référence introuvable'; end if;
 oldq:=i.quantity_total;
 if p_type='STOCK_IN' then newq:=oldq+p_quantity;
 elsif p_type in ('STOCK_OUT','LOST','BROKEN','RETIRED') then
  if (i.quantity_total-i.quantity_reserved-i.quantity_assigned)<p_quantity then raise exception 'Stock disponible insuffisant'; end if;
  newq:=oldq-p_quantity;
 else raise exception 'Type de mouvement invalide';
 end if;
 update public.inventory_items set quantity_total=newq where id=p_item_id;
 select display_name into actor from public.profiles where id=uid;
 insert into public.inventory_movements(item_id,movement_type,quantity,old_total,new_total,actor_id,note)
 values(p_item_id,p_type,p_quantity,oldq,newq,uid,p_note);
 insert into public.audit_events(actor_id,actor_name,action,target_type,target_id,details)
 values(uid,actor,lower(p_type),'inventory_item',p_item_id::text,jsonb_build_object('quantity',p_quantity,'old_total',oldq,'new_total',newq,'note',p_note));
end $$;

create or replace function public.reserve_inventory(p_ticket_id uuid,p_item_id uuid,p_quantity integer)
returns uuid language plpgsql security definer set search_path=public as $$
declare i public.inventory_items%rowtype; t public.tickets%rowtype; uid uuid=(select auth.uid()); allocation uuid; actor text;
begin
 if not private.is_active_user() then raise exception 'Compte inactif'; end if;
 if p_quantity<=0 then raise exception 'Quantité invalide'; end if;
 select * into t from public.tickets where id=p_ticket_id;
 if not found then raise exception 'Ticket introuvable'; end if;
 if not private.is_manager() and t.assigned_to is distinct from uid then raise exception 'Accès refusé'; end if;
 select * into i from public.inventory_items where id=p_item_id for update;
 if (i.quantity_total-i.quantity_reserved-i.quantity_assigned)<p_quantity then raise exception 'Stock insuffisant'; end if;
 update public.inventory_items set quantity_reserved=quantity_reserved+p_quantity where id=p_item_id;
 insert into public.inventory_allocations(item_id,ticket_id,quantity,status,created_by)
 values(p_item_id,p_ticket_id,p_quantity,'reserved',uid) returning id into allocation;
 insert into public.inventory_movements(item_id,movement_type,quantity,ticket_id,allocation_id,actor_id)
 values(p_item_id,'RESERVATION',p_quantity,p_ticket_id,allocation,uid);
 select display_name into actor from public.profiles where id=uid;
 insert into public.audit_events(actor_id,actor_name,action,target_type,target_id,details)
 values(uid,actor,'inventory_reserved','inventory_item',p_item_id::text,jsonb_build_object('ticket_id',p_ticket_id,'quantity',p_quantity));
 return allocation;
end $$;

create or replace function public.release_inventory(p_allocation_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare a public.inventory_allocations%rowtype; uid uuid=(select auth.uid()); t public.tickets%rowtype;
begin
 if not private.is_active_user() then raise exception 'Compte inactif'; end if;
 select * into a from public.inventory_allocations where id=p_allocation_id for update;
 if not found or a.status<>'reserved' then raise exception 'Réservation introuvable'; end if;
 if a.ticket_id is not null then select * into t from public.tickets where id=a.ticket_id; end if;
 if not private.is_manager() and (a.ticket_id is null or t.assigned_to is distinct from uid) then raise exception 'Accès refusé'; end if;
 update public.inventory_items set quantity_reserved=quantity_reserved-a.quantity where id=a.item_id;
 update public.inventory_allocations set status='cancelled',updated_at=now() where id=a.id;
 insert into public.inventory_movements(item_id,movement_type,quantity,ticket_id,allocation_id,actor_id)
 values(a.item_id,'RESERVATION_CANCELLED',a.quantity,a.ticket_id,a.id,uid);
end $$;

create or replace function public.kpi_dashboard(p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare closed_label text; inprogress_label text; waiting_label text; result jsonb;
begin
 if not private.is_manager() then raise exception 'Accès Manager requis'; end if;
 if p_to<p_from then raise exception 'Période invalide'; end if;
 select label into closed_label from public.config_values where kind='status' and code='closed' limit 1;
 select label into inprogress_label from public.config_values where kind='status' and code='in_progress' limit 1;
 select label into waiting_label from public.config_values where kind='status' and code='waiting' limit 1;
 closed_label:=coalesce(closed_label,'Clôturé'); inprogress_label:=coalesce(inprogress_label,'En cours'); waiting_label:=coalesce(waiting_label,'En attente');
 with summary as (
  select
   count(*) filter(where created_at>=p_from::timestamptz and created_at<(p_to+1)::timestamptz) created,
   count(*) filter(where closed_at>=p_from::timestamptz and closed_at<(p_to+1)::timestamptz) closed,
   count(*) filter(where status=inprogress_label) in_progress,
   count(*) filter(where status=waiting_label) waiting,
   count(*) filter(where is_blocking and status<>closed_label) blocking,
   count(*) filter(where status<>closed_label and created_at<(p_to+1)::timestamptz) backlog,
   round(coalesce(avg(extract(epoch from (closed_at-created_at))/3600) filter(where closed_at>=p_from::timestamptz and closed_at<(p_to+1)::timestamptz),0)::numeric,1) avg_resolution_hours,
   round(coalesce(avg(extract(epoch from (planned_start-arrival_at))/3600) filter(where planned_start is not null and arrival_at>=p_from::timestamptz and arrival_at<(p_to+1)::timestamptz),0)::numeric,1) avg_takeover_hours
  from public.tickets
 ), base_summary as (
  select s.*,
   (select count(*) from public.audit_events where action='ticket_reopened' and created_at>=p_from::timestamptz and created_at<(p_to+1)::timestamptz) reopened,
   case when s.created=0 then 0 else round((s.closed::numeric/s.created::numeric)*100,1) end closure_rate
  from summary s
 ), timeline as (
  select d::date period,
   (select count(*) from public.tickets t where t.created_at>=d and t.created_at<d+interval '1 day') created,
   (select count(*) from public.tickets t where t.closed_at>=d and t.closed_at<d+interval '1 day') closed
  from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 ), bytech as (
  select p.id,p.display_name name,
   count(t.id) filter(where t.created_at>=p_from::timestamptz and t.created_at<(p_to+1)::timestamptz) total,
   count(t.id) filter(where t.closed_at>=p_from::timestamptz and t.closed_at<(p_to+1)::timestamptz) closed
  from public.profiles p left join public.tickets t on t.assigned_to=p.id
  where p.role in ('technician','manager')
  group by p.id,p.display_name order by p.display_name
 ), inv as (
  select count(*) filter(where (quantity_total-quantity_reserved-quantity_assigned)<=stock_minimum) low_stock,
         coalesce(sum(unit_price*quantity_total),0) total_value
  from public.inventory_items where active=true
 )
 select jsonb_build_object(
  'summary',(select to_jsonb(base_summary) from base_summary),
  'timeline',(select coalesce(jsonb_agg(jsonb_build_object('period',to_char(period,'YYYY-MM-DD'),'created',created,'closed',closed) order by period),'[]'::jsonb) from timeline),
  'by_technician',(select coalesce(jsonb_agg(to_jsonb(bytech) order by name),'[]'::jsonb) from bytech bytech),
  'inventory',(select to_jsonb(inv) from inv)
 ) into result;
 return result;
end $$;

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_assets enable row level security;
alter table public.inventory_allocations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers for select to authenticated using(private.is_active_user());
drop policy if exists customers_manager_all on public.customers;
create policy customers_manager_all on public.customers for all to authenticated using(private.is_manager()) with check(private.is_manager());

drop policy if exists customer_contacts_select on public.customer_contacts;
create policy customer_contacts_select on public.customer_contacts for select to authenticated using(private.is_active_user());
drop policy if exists customer_contacts_manager_all on public.customer_contacts;
create policy customer_contacts_manager_all on public.customer_contacts for all to authenticated using(private.is_manager()) with check(private.is_manager());

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select on public.inventory_items for select to authenticated using(private.is_active_user());
drop policy if exists inventory_items_manager_all on public.inventory_items;
create policy inventory_items_manager_all on public.inventory_items for all to authenticated using(private.is_manager()) with check(private.is_manager());

drop policy if exists inventory_assets_select on public.inventory_assets;
create policy inventory_assets_select on public.inventory_assets for select to authenticated using(private.is_active_user());
drop policy if exists inventory_assets_manager_all on public.inventory_assets;
create policy inventory_assets_manager_all on public.inventory_assets for all to authenticated using(private.is_manager()) with check(private.is_manager());

drop policy if exists inventory_allocations_select on public.inventory_allocations;
create policy inventory_allocations_select on public.inventory_allocations for select to authenticated using(
 private.is_manager() or exists(select 1 from public.tickets t where t.id=inventory_allocations.ticket_id and t.assigned_to=(select auth.uid()))
);
drop policy if exists inventory_allocations_manager_all on public.inventory_allocations;
create policy inventory_allocations_manager_all on public.inventory_allocations for all to authenticated using(private.is_manager()) with check(private.is_manager());

drop policy if exists inventory_movements_manager_select on public.inventory_movements;
create policy inventory_movements_manager_select on public.inventory_movements for select to authenticated using(private.is_manager());

drop policy if exists audit_events_manager_select on public.audit_events;
create policy audit_events_manager_select on public.audit_events for select to authenticated using(private.is_manager());

revoke all on public.customers,public.customer_contacts,public.inventory_items,public.inventory_assets,public.inventory_allocations,public.inventory_movements,public.audit_events from anon;
grant select,insert,update,delete on public.customers,public.customer_contacts,public.inventory_items,public.inventory_assets,public.inventory_allocations to authenticated;
grant select on public.inventory_movements,public.audit_events to authenticated;
grant usage,select on all sequences in schema public to authenticated;

revoke all on function public.record_login() from public,anon;
revoke all on function public.complete_password_change() from public,anon;
revoke all on function public.close_ticket(uuid,text) from public,anon;
revoke all on function public.reopen_ticket(uuid) from public,anon;
revoke all on function public.inventory_move(uuid,text,integer,text) from public,anon;
revoke all on function public.reserve_inventory(uuid,uuid,integer) from public,anon;
revoke all on function public.release_inventory(uuid) from public,anon;
revoke all on function public.kpi_dashboard(date,date) from public,anon;
grant execute on function public.record_login() to authenticated;
grant execute on function public.complete_password_change() to authenticated;
grant execute on function public.close_ticket(uuid,text) to authenticated;
grant execute on function public.reopen_ticket(uuid) to authenticated;
grant execute on function public.inventory_move(uuid,text,integer,text) to authenticated;
grant execute on function public.reserve_inventory(uuid,uuid,integer) to authenticated;
grant execute on function public.release_inventory(uuid) to authenticated;
grant execute on function public.kpi_dashboard(date,date) to authenticated;

do $$
declare t text;
begin
 foreach t in array array['tickets','ticket_comments','ticket_materials','customers','inventory_items','inventory_allocations'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
   execute format('alter publication supabase_realtime add table public.%I',t);
  end if;
 end loop;
end $$;

create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_customer_contacts_customer on public.customer_contacts(customer_id);
create index if not exists idx_inventory_items_model on public.inventory_items(model);
create index if not exists idx_inventory_allocations_ticket on public.inventory_allocations(ticket_id);
create index if not exists idx_inventory_movements_item_created on public.inventory_movements(item_id,created_at desc);
create index if not exists idx_audit_events_created on public.audit_events(created_at desc);
create index if not exists idx_tickets_customer on public.tickets(customer_id);
