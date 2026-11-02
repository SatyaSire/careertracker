import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtDateTime, fmtDate } from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { InterviewForm } from "@/components/InterviewForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_COLORS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CalendarDays, Plus, Pencil, Trash2, ExternalLink, Clock, Video } from "lucide-react";
import { toast } from "sonner";

const Row = ({ iv, navigate, onEdit, onDel }) => (
  <Card data-testid={`interview-item-${iv.id}`}>
    <CardContent className="p-4 flex items-start justify-between gap-3">
      <div className="flex gap-3 min-w-0">
        <div className="shrink-0 h-11 w-11 rounded-lg bg-violet-500/10 grid place-items-center"><Video className="h-5 w-5 text-violet-500" /></div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-medium truncate">{iv.round || "Interview"}{iv.job_title ? ` · ${iv.job_title}` : ""}</span><StatusBadge status={iv.status} color={STATUS_COLORS[iv.status] || "violet"} /></div>
          <div className="text-xs text-muted-foreground mt-1">{[iv.company_name, iv.type, iv.interviewer_name].filter(Boolean).join(" · ")}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(iv.interview_date)} {iv.timezone && `(${iv.timezone})`}</div>
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0">
        {iv.meeting_url && <a href={iv.meeting_url} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button></a>}
        {iv.application_id && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/applications/${iv.application_id}`)}><CalendarDays className="h-4 w-4" /></Button>}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(iv)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDel(iv)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </CardContent>
  </Card>
);

export default function Interviews() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(() => { setLoading(true); api.get("/interviews").then(({ data }) => setItems(data)).finally(() => setLoading(false)); }, []);
  useEffect(load, [load]);

  const doDelete = async () => { await api.delete(`/interviews/${del.id}`); toast.success("Deleted"); setDel(null); load(); };
  const now = new Date();
  const upcoming = items.filter((i) => ["Scheduled", "Rescheduled"].includes(i.status) && i.interview_date && new Date(i.interview_date) >= now).sort((a, b) => new Date(a.interview_date) - new Date(b.interview_date));
  const past = items.filter((i) => !upcoming.includes(i));

  // group upcoming by date for calendar-style
  const byDate = {};
  upcoming.forEach((i) => { const d = i.interview_date ? fmtDate(i.interview_date) : "Unscheduled"; (byDate[d] = byDate[d] || []).push(i); });

  return (
    <div>
      <PageHeader title="Interviews & Calendar" subtitle={`${upcoming.length} upcoming · ${past.length} past`}>
        <Button onClick={() => { setEditing(null); setForm(true); }} data-testid="add-interview-btn"><Plus className="h-4 w-4 mr-1.5" />New Interview</Button>
      </PageHeader>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <Card><EmptyState icon={CalendarDays} title="No interviews" description="Schedule interview rounds with dates, platforms and preparation notes." action={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-1.5" />New Interview</Button>} /></Card>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList><TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming ({upcoming.length})</TabsTrigger><TabsTrigger value="past" data-testid="tab-past">Past ({past.length})</TabsTrigger></TabsList>
          <TabsContent value="upcoming" className="mt-4 space-y-5">
            {upcoming.length === 0 ? <Card><EmptyState icon={CalendarDays} title="No upcoming interviews" /></Card> :
              Object.entries(byDate).map(([date, list]) => (
                <div key={date}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{date}</div>
                  <div className="space-y-3">{list.map((iv) => <Row key={iv.id} iv={iv} navigate={navigate} onEdit={(x) => { setEditing(x); setForm(true); }} onDel={setDel} />)}</div>
                </div>
              ))}
          </TabsContent>
          <TabsContent value="past" className="mt-4 space-y-3">
            {past.length === 0 ? <Card><EmptyState icon={CalendarDays} title="No past interviews" /></Card> :
              past.sort((a, b) => new Date(b.interview_date || 0) - new Date(a.interview_date || 0)).map((iv) => <Row key={iv.id} iv={iv} navigate={navigate} onEdit={(x) => { setEditing(x); setForm(true); }} onDel={setDel} />)}
          </TabsContent>
        </Tabs>
      )}
      <InterviewForm open={form} onOpenChange={setForm} initial={editing} onSaved={load} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete interview?" description="This interview round will be removed." onConfirm={doDelete} />
    </div>
  );
}
