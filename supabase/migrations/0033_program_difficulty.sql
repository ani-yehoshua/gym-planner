-- How demanding a program is. Optional: programs that predate this have none.
alter table programs
  add column difficulty text
  check (difficulty in ('beginner', 'intermediate', 'advanced'));
