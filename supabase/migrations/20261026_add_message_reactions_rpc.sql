-- ==============================================================================
-- Migration: Add reactions support and toggle_message_reaction RPC
-- ==============================================================================

-- 1. Ensure reactions column exists on circle_messages
alter table public.circle_messages 
add column if not exists reactions jsonb default '{}'::jsonb;

-- 2. Create atomic toggle_message_reaction function
create or replace function public.toggle_message_reaction(
  p_message_id uuid,
  p_emoji text
)
returns jsonb
language plpgsql
security definer
as $func$
declare
  v_user_id uuid := auth.uid();
  v_circle_id uuid;
  v_reactions jsonb;
  v_user_list jsonb;
  v_new_list jsonb;
  v_has_user boolean := false;
  v_elem text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select circle_id, coalesce(reactions, '{}'::jsonb)
  into v_circle_id, v_reactions
  from public.circle_messages
  where id = p_message_id;

  if v_circle_id is null then
    raise exception 'Message not found';
  end if;

  if not exists (
    select 1 from public.circle_members
    where circle_id = v_circle_id and user_id = v_user_id
  ) and not exists (
    select 1 from public.circles
    where id = v_circle_id and owner_id = v_user_id
  ) then
    raise exception 'Not a circle member';
  end if;

  v_user_list := coalesce(v_reactions -> p_emoji, '[]'::jsonb);
  
  for v_elem in select jsonb_array_elements_text(v_user_list)
  loop
    if v_elem = v_user_id::text then
      v_has_user := true;
    end if;
  end loop;

  if v_has_user then
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_new_list
    from jsonb_array_elements_text(v_user_list) as elem
    where elem <> v_user_id::text;
  else
    v_new_list := v_user_list || to_jsonb(v_user_id::text);
  end if;

  if jsonb_array_length(v_new_list) = 0 then
    v_reactions := v_reactions - p_emoji;
  else
    v_reactions := jsonb_set(v_reactions, array[p_emoji], v_new_list, true);
  end if;

  update public.circle_messages
  set reactions = v_reactions
  where id = p_message_id;

  return v_reactions;
end;
$func$;

grant execute on function public.toggle_message_reaction(uuid, text) to authenticated;
