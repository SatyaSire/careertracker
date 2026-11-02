import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtDateTime } from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { Card, CardContent } from "@/components/ui/card";
import { History, Plus, Pencil, Trash2, RefreshCw, ClipboardCheck, CalendarDays, FileText, Archive } from "lucide-react";

const ICONS = { created: Plus, updated: Pencil, deleted: Trash2, status_changed: RefreshCw, restored: Archive };
const TONE = { created: "text-emerald-500 bg-emerald-500/10", updated: "text-blue-500 bg-blue-500/10", deleted: "text-red-500 bg-red-500/10", status_changed: "text-violet-500 bg-violet-500/10", restored: "text-amber-500 bg-amber-500/10" };

export default function Activity() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.get("/activity", { params: { limit: 300 } }).then(({ data }) => setItems(data)).finally(() => setLoading(false)); }, []);

  return (
    <div>
      <PageHeader title="Activity History" subtitle="A complete log of every important action you've taken." />
      {loading ? <LoadingState /> : items.length === 0 ? (
        <Card><EmptyState icon={History} title="No activity yet" description="Your actions will appear here as you manage applications." /></Card>
      ) : (
        <Card><CardContent className="p-5">
          <div className="space-y-1">
            {items.map((a, i) => {
              const Icon = ICONS[a.action] || History;
              return (
                <button key={a.id || i} onClick={() => a.application_id && navigate(`/applications/${a.application_id}`)} data-testid={`activity-${i}`}
                  className={`w-full flex items-start gap-3 py-2.5 px-2 rounded-lg text-left ${a.application_id ? "hover:bg-secondary" : ""}`}>
                  <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${TONE[a.action] || "text-slate-500 bg-slate-500/10"}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{a.summary}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.entity} · {fmtDateTime(a.created_at)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
