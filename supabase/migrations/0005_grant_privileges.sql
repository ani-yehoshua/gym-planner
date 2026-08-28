-- Table-level privileges for the API roles. RLS still governs which rows.
-- The project did not auto-grant these to `authenticated`, so every logged-in
-- write (onboarding, logging sets, etc.) was failing with "permission denied".
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;

revoke all on function handle_new_user()         from anon, authenticated;
revoke all on function handle_new_party()         from anon, authenticated;
revoke all on function touch_updated_at()         from anon, authenticated;
revoke all on function join_party_with_code(text) from anon;
revoke all on function is_party_member(uuid)      from anon;
revoke all on function is_party_owner(uuid)       from anon;
grant execute on function join_party_with_code(text) to authenticated;
grant execute on function is_party_member(uuid)   to authenticated;
grant execute on function is_party_owner(uuid)    to authenticated;
