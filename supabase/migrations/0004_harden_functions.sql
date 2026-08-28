-- Harden functions flagged by the Supabase security linter.
create or replace function touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

revoke all on function handle_new_user()   from anon, authenticated;
revoke all on function handle_new_party()  from anon, authenticated;
revoke all on function touch_updated_at()  from anon, authenticated;
revoke all on function join_party_with_code(text) from anon;
revoke all on function is_party_member(uuid) from anon;
revoke all on function is_party_owner(uuid) from anon;
