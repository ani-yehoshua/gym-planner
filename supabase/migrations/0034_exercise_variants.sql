-- Grip variants of the same lift (Lat Pulldown: Wide / Close / Neutral…) are
-- separate exercises so each keeps its own history, PRs and defaults, but they
-- read as one entry in the catalog and the add / swap pickers. `variant_group`
-- is the shared name, `variant_label` the grip. Both null = a normal exercise.
alter table exercises
  add column variant_group text,
  add column variant_label text;

update exercises
  set variant_group = 'Bent-Over Barbell Row',
      variant_label = substring(name from '\((.*)\)')
  where name like 'Bent-Over Barbell Row (%)';

update exercises
  set variant_group = 'Lat Pulldown',
      variant_label = substring(name from '\((.*)\)')
  where name like 'Lat Pulldown (%)';

-- an older duplicate of "Lat Pulldown (Wide)": hide it from the catalog (days
-- and history that already use it keep working)
update exercises
  set archived_at = now()
  where name = 'Wide-Grip Lat Pulldown' and archived_at is null;
