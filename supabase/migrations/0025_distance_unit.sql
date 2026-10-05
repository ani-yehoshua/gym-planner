-- Distance gets its own unit, independent of the weight unit (profiles.units):
-- someone can lift in lb but track carries in meters or walks in km. Same
-- never-convert rule as weight — it only changes the label next to the number.
alter table profiles
  add column distance_unit text not null default 'mi'
  check (distance_unit in ('mi', 'km', 'm'));

-- keep existing users' labels exactly as they were (kg/metric -> km, lb -> mi)
update profiles set distance_unit = 'km' where units = 'kg';
