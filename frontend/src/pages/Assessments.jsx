import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api, { fmtDateTime } from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { AssessmentForm } from "@/components/AssessmentForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_COLORS, ASSESSMENT_STATUSES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck, Plus, Pencil, Trash2, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";

const ALL = "__all__";
export default function Assessments() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(sp.get("status") || "");
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = {}; if (status) params.status = status;
    api.get("/assessments", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [status]);
  useEffect(load, [load]);

  const doDelete = async () => { await api.delete(`/assessments/${del.id}`); toast.success("Deleted"); setDel(null); load(); };
  const now = new Date();

  return (
    <div>
      <PageHeader title="Assessments" subtitle={`${items.length} assessment${items.length === 1 ? "" : "s"} tracked`}>
        <Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? "" : v)}>
          <SelectTrigger className="w-[150px]" data-testid="assessment-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-popover max-h-72"><SelectItem value={ALL}>All Statuses</SelectItem>{ASSESSMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={() => { setEditing(null); setForm(true); }} data-testid="add-assessment-btn"><Plus className="h-4 w-4 mr-1.5" />New Assessment</Button>
      </PageHeader>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <Card><EmptyState icon={ClipboardCheck} title="No assessments" description="Track coding tests, MCQs, aptitude and take-home assignments." action={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-1.5" />New Assessment</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a) => {
            const overdue = a.deadline && new Date(a.deadline) < now && !["Completed", "Submitted", "Passed", "Failed", "Expired", "Cancelled"].includes(a.status);
            return (
              <Card key={a.id} data-testid={`assessment-item-${a.id}`} className={overdue ? "border-destructive/40" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-medium truncate">{a.name}</div><div className="text-xs text-muted-foreground truncate">{[a.type, a.platform].filter(Boolean).join(" · ") || "Assessment"}</div></div>
                    <StatusBadge status={a.status} color={STATUS_COLORS[a.status] || "slate"} />
                  </div>
                  {a.company_name && <div className="text-xs text-muted-foreground mt-2">{a.company_name}</div>}
                  {a.deadline && <div className={`text-xs mt-1 flex items-center gap-1 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}><Clock className="h-3 w-3" />Deadline {fmtDateTime(a.deadline)}</div>}
                  {a.score && <div className="text-xs text-muted-foreground mt-1">Score: {a.score}{a.max_score ? `/${a.max_score}` : ""}</div>}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                    {a.application_id && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate(`/applications/${a.application_id}`)}>Open Application</Button>}
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="ml-auto"><Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-4 w-4" /></Button></a>}
                    <Button variant="ghost" size="icon" className={`h-7 w-7 ${a.url ? "" : "ml-auto"}`} onClick={() => { setEditing(a); setForm(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDel(a)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <AssessmentForm open={form} onOpenChange={setForm} initial={editing} onSaved={load} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete assessment?" description={`"${del?.name}" will be removed.`} onConfirm={doDelete} />
    </div>
  );
}
