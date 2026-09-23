create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.database_restore_chunk_internal(
  p_table text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_rel regclass;
  v_pk_cols text;
  v_insert_cols text;
  v_select_cols text;
  v_update_set text;
  v_sql text;
  v_count integer := 0;
begin
  if p_table is null or p_table !~ '^[a-zA-Z_][a-zA-Z0-9_]*$' then
    raise exception 'Nom de table invalide';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Le contenu à restaurer doit être un tableau JSON';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    return 0;
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Lot trop volumineux (500 lignes maximum)';
  end if;

  select c.oid::regclass
    into v_rel
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = p_table
    and c.relkind in ('r','p');

  if v_rel is null then
    raise exception 'Table métier non autorisée : %', p_table;
  end if;

  select string_agg(format('%I', a.attname), ', ' order by ord.ordinality)
    into v_pk_cols
  from pg_index i
  join lateral unnest(i.indkey) with ordinality ord(attnum, ordinality) on true
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = ord.attnum
  where i.indrelid = v_rel
    and i.indisprimary;

  if v_pk_cols is null then
    raise exception 'La table % ne possède pas de clé primaire exploitable', p_table;
  end if;

  select
    string_agg(format('%I', a.attname), ', ' order by a.attnum),
    string_agg(format('r.%I', a.attname), ', ' order by a.attnum)
  into v_insert_cols, v_select_cols
  from pg_attribute a
  where a.attrelid = v_rel
    and a.attnum > 0
    and not a.attisdropped
    and coalesce(a.attgenerated, '') = '';

  select string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum)
    into v_update_set
  from pg_attribute a
  where a.attrelid = v_rel
    and a.attnum > 0
    and not a.attisdropped
    and coalesce(a.attgenerated, '') = ''
    and not exists (
      select 1
      from pg_index i
      join unnest(i.indkey) k(attnum) on true
      where i.indrelid = v_rel
        and i.indisprimary
        and k.attnum = a.attnum
    );

  if v_update_set is null then
    v_sql := format(
      'insert into public.%1$I (%2$s) overriding system value
       select %3$s
       from jsonb_populate_recordset(null::public.%1$I, $1) as r
       on conflict (%4$s) do nothing',
      p_table, v_insert_cols, v_select_cols, v_pk_cols
    );
  else
    v_sql := format(
      'insert into public.%1$I (%2$s) overriding system value
       select %3$s
       from jsonb_populate_recordset(null::public.%1$I, $1) as r
       on conflict (%4$s) do update set %5$s',
      p_table, v_insert_cols, v_select_cols, v_pk_cols, v_update_set
    );
  end if;

  execute v_sql using p_rows;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke all on function public.database_restore_chunk_internal(text,jsonb) from public, anon, authenticated;
grant execute on function public.database_restore_chunk_internal(text,jsonb) to service_role;

create or replace function public.database_restore_finalize_internal()
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_seq text;
  v_max bigint;
  v_reset integer := 0;
begin
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and (c.is_identity = 'YES' or c.column_default like 'nextval(%')
  loop
    v_seq := pg_get_serial_sequence(format('public.%I', r.table_name), r.column_name);
    if v_seq is null then
      continue;
    end if;

    execute format('select max(%I)::bigint from public.%I', r.column_name, r.table_name)
      into v_max;

    if v_max is null then
      perform setval(v_seq::regclass, 1, false);
    else
      perform setval(v_seq::regclass, v_max, true);
    end if;
    v_reset := v_reset + 1;
  end loop;

  return v_reset;
end
$$;

revoke all on function public.database_restore_finalize_internal() from public, anon, authenticated;
grant execute on function public.database_restore_finalize_internal() to service_role;

create or replace function private.check_backup_reminder()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_last_backup timestamptz;
  v_last_reminder timestamptz;
  v_emails text[];
  v_api_key text;
  v_from text;
  v_request_id bigint;
begin
  select max(created_at)
    into v_last_backup
  from public.audit_events
  where action = 'database_business_backup_exported';

  if v_last_backup is not null
     and v_last_backup >= now() - interval '6 hours' then
    return;
  end if;

  select max(created_at)
    into v_last_reminder
  from public.audit_events
  where action = 'database_backup_reminder_email_queued';

  if v_last_reminder is not null
     and (v_last_backup is null or v_last_reminder > v_last_backup) then
    return;
  end if;

  select array_agg(email order by email)
    into v_emails
  from public.profiles
  where active = true
    and role = 'manager'
    and nullif(trim(coalesce(email,'')), '') is not null;

  if coalesce(array_length(v_emails,1),0) = 0 then
    return;
  end if;

  select decrypted_secret
    into v_api_key
  from vault.decrypted_secrets
  where name = 'resend_api_key'
  limit 1;

  if nullif(trim(coalesce(v_api_key,'')), '') is null then
    return;
  end if;

  select decrypted_secret
    into v_from
  from vault.decrypted_secrets
  where name = 'backup_email_from'
  limit 1;

  v_from := coalesce(nullif(trim(v_from),''), 'Planning <onboarding@resend.dev>');

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_api_key
    ),
    body := jsonb_build_object(
      'from', v_from,
      'to', v_emails,
      'subject', 'Planning - sauvegarde BDD à effectuer',
      'html',
      '<h2>Sauvegarde Planning à effectuer</h2>' ||
      '<p>Aucune sauvegarde complète de la base métier n''a été enregistrée depuis plus de 6 heures.</p>' ||
      '<p>Connectez-vous à Planning et lancez <strong>Exporter toute la BDD (.xlsx)</strong> depuis Configuration.</p>'
    ),
    timeout_milliseconds := 10000
  ) into v_request_id;

  insert into public.audit_events(
    actor_id, actor_name, action, target_type, target_id, details
  )
  values(
    null, 'Système', 'database_backup_reminder_email_queued', 'database', null,
    jsonb_build_object(
      'request_id', v_request_id,
      'recipients', v_emails,
      'last_backup_at', v_last_backup,
      'threshold_hours', 6
    )
  );
end
$$;

revoke all on function private.check_backup_reminder() from public, anon, authenticated;

do $$
begin
  if exists(select 1 from cron.job where jobname='planning-backup-reminder-hourly') then
    perform cron.unschedule('planning-backup-reminder-hourly');
  end if;

  perform cron.schedule(
    'planning-backup-reminder-hourly',
    '5 * * * *',
    'select private.check_backup_reminder();'
  );
end
$$;
