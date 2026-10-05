-- Wall Sit isn't normally loaded, so it shouldn't force a weight field next to
-- its sets. `weighted = false` makes the weight field an opt-in
-- ("+ Track weight") instead — anyone who does hold a plate can still turn it on.
update exercises set weighted = false where name = 'Wall Sit';
