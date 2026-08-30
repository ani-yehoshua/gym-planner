"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const OPTIONS = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
] as const;

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // next-themes resolves the real value only on the client
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    return (
        <div className='inline-flex rounded-lg border border-border p-0.5'>
            {OPTIONS.map(o => {
                const active = mounted && theme === o.value;
                return (
                    <button
                        key={o.value}
                        type='button'
                        onClick={() => setTheme(o.value)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            active
                                ? "bg-surface-2 text-text"
                                : "text-text-muted hover:text-text"
                        }`}>
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
