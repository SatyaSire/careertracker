import React from "react";

const PALETTE = {
  slate: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30",
  red: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
};

export const StatusBadge = ({ status, color = "slate", testid }) => (
  <span
    data-testid={testid}
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${PALETTE[color] || PALETTE.slate}`}
  >
    {status}
  </span>
);
