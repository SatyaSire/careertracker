import React from "react";

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
    <div>
      <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight" data-testid="page-title">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6" data-testid="empty-state">
    {Icon && <div className="rounded-2xl bg-muted p-4 mb-4"><Icon className="h-8 w-8 text-muted-foreground" /></div>}
    <h3 className="font-display text-lg font-semibold">{title}</h3>
    {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const LoadingState = ({ rows = 5 }) => (
  <div className="space-y-3" data-testid="loading-state">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
    ))}
  </div>
);
