-- A "1RM" day: a session type like Push or Pull, but for working up to one
-- heavy single on each lift. The heaviest single logged becomes the member's
-- estimated 1RM for that exercise (done in the logSet action).
alter type muscle_category add value if not exists 'one_rm';
