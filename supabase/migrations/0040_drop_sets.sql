-- Drop sets. A logged set can carry a chain of drops after its top weight, each
-- with its own weight and reps: [{"weight": 115, "reps": 8}, ...]. `volume`
-- stops being a generated column so it can total the drops too; a trigger keeps
-- it equal to weight × reps plus every drop's weight × reps, so everything that
-- reads `volume` keeps working.
alter table set_logs add column drops jsonb;

alter table set_logs drop column volume;
alter table set_logs add column volume numeric;

create function set_logs_compute_volume() returns trigger
language plpgsql as $$
begin
  new.volume := coalesce(new.weight, 0) * coalesce(new.reps, 0)
    + coalesce((
        select sum(coalesce((d->>'weight')::numeric, 0) * coalesce((d->>'reps')::numeric, 0))
        from jsonb_array_elements(
          case when jsonb_typeof(new.drops) = 'array' then new.drops else '[]'::jsonb end
        ) d
      ), 0);
  return new;
end $$;

create trigger set_logs_volume before insert or update on set_logs
  for each row execute function set_logs_compute_volume();

update set_logs set weight = weight;  -- backfill volume for existing rows
