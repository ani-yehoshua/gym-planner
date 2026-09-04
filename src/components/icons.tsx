type P = { className?: string };
const base = "h-5 w-5";
const svg = (className?: string) => ({
  className: className ?? base,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const CalendarIcon = ({ className }: P) => (
  <svg {...svg(className)}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </svg>
);

export const DumbbellIcon = ({ className }: P) => (
  <svg {...svg(className)}>
    <path d="M3 9v6M6.5 7.5v9M17.5 7.5v9M21 9v6M6.5 12h11" />
  </svg>
);

export const UsersIcon = ({ className }: P) => (
  <svg {...svg(className)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const ChartIcon = ({ className }: P) => (
  <svg {...svg(className)}>
    <path d="M3 3v18h18" />
    <path d="M7 15l3-4 3 3 4-6" />
  </svg>
);

export const UserIcon = ({ className }: P) => (
  <svg {...svg(className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
  </svg>
);

export const ChevronLeftIcon = ({ className }: P) => (
  <svg {...svg(className ?? "h-4 w-4")}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const TrashIcon = ({ className }: P) => (
  <svg {...svg(className ?? "h-4 w-4")}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const ExitIcon = ({ className }: P) => (
  <svg {...svg(className ?? "h-4 w-4")}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const ResumeIcon = ({ className }: P) => (
  <svg {...svg(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10.5 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
  </svg>
);
