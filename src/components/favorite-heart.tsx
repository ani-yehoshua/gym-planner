"use client";

import { useState, useTransition } from "react";
import { setFavoriteExercise } from "@/app/actions";

/** Red heart that favorites an exercise: outline when it isn't one, filled
 *  when it is. Flips right away; the save follows. */
export function FavoriteHeart({
    exerciseId,
    initial,
    className = "",
}: {
    exerciseId: string;
    initial: boolean;
    className?: string;
}) {
    const [fav, setFav] = useState(initial);
    const [, start] = useTransition();

    return (
        <button
            type='button'
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={fav}
            title={fav ? "Favorite" : "Add to favorites"}
            onClick={e => {
                // it can sit inside a <summary>: don't open/close that too
                e.preventDefault();
                e.stopPropagation();
                const next = !fav;
                setFav(next);
                start(() => setFavoriteExercise(exerciseId, next));
            }}
            className={`text-rose-500 hover:text-rose-600 ${className}`}>
            <svg
                viewBox='0 0 24 24'
                className='h-4 w-4'
                fill={fav ? "currentColor" : "none"}
                stroke='currentColor'
                strokeWidth='2'
                strokeLinejoin='round'
                aria-hidden>
                <path d='M12 20.5s-7.5-4.6-9.6-9.3C1 8 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6h2c.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.6 3.5 4.2 6.7-2.1 4.7-9.6 9.3-9.6 9.3z' />
            </svg>
        </button>
    );
}
