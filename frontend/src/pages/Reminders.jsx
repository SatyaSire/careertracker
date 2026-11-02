import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtDateTime } from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { PRIORITY_COLORS, REMINDER_TYPES, REMINDER_PRIORITIES, REMINDER_STATUSES } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Plus, Pencil, Trash2, Clock, BellRing } from "lucide-react";
import { toast } from "sonner";

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, a] = await Promise.all([api.get("/reminders"), api.get("/applications", { params: { page_size: 500 } })]);
    setItems(r.data); setApps(a.data.items); setLoading(false);
  }, []);
  useEffect(() => { load(); }, []);

  const requestNotif = () => {
    if (!("Notification" in window)) { toast.error("Notifications not supported"); return; }
    Notification.requestPermission().then((p) => { if (p === "granted") toast.success("Browser notifications enabled"); else toast.message("Notifications not enabled"); });
  };

  const fields = [
    { name: "title", label: "Title", required: true, colSpan: 2 },
    { name: "application_id", label: "Related Application", type: "select", options: apps.map((a) => ({ value: a.id, label: `${a.job_title} — ${a.company_name}` })), colSpan: 2 },
    { name: "type", label: "Reminder Type", type: "select", options: REMINDER_TYPES },
    { name: "priority", label: "Priority", type: "select", options: REMINDER_PRIORITIES },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "due_time", label: "Due Time", type: "time" },
    { name: "status", label: "Status", type: "select", options: REMINDER_STATUSES },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2 },
  ];

  const submit = async (values) => {
    try { if (editing) await api.put(`/reminders/${editing.id}`, values); else await api.post("/reminders", values); toast.success(editing ? "Updated" : "Created"); load(); }
    catch { toast.error("Failed"); throw new Error(); }
  };
  const toggleDone = async (r) => { await api.put(`/reminders/${r.id}`, { status: r.status === "Completed" ? "Pending" : "Completed" }); load(); };
  const doDelete = async () => { await api.delete(`/reminders/${del.id}`); toast.success("Deleted"); setDel(null); load(); };

  const now = new Date();
  const sorted = [...items].sort((a, b) => (a.status === "Completed") - (b.status === "Completed") || new Date(a.due_date || 0) - new Date(b.due_date || 0));

  return (
    <div>
      <PageHeader title="Reminders & Follow-ups" subtitle="Deadlines, follow-ups and tasks across your applications.">
        <Button variant="outline" onClick={requestNotif} data-testid="enable-notif-btn"><BellRing className="h-4 w-4 mr-1.5" />Enable Notifications</Button>
        <Button onClick={() => { setEditing(null); setForm(true); }} data-testid="add-reminder-btn"><Plus className="h-4 w-4 mr-1.5" />New Reminder</Button>
      </PageHeader>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <Card><EmptyState icon={Bell} title="No reminders" description="Create reminders for assessment deadlines, interviews and recruiter follow-ups." action={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-1.5" />New Reminder</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => {
            const overdue = r.status === "Pending" && r.due_date && new Date(r.due_date) < now;
            return (
              <Card key={r.id} data-testid={`reminder-item-${r.id}`} className={`${r.status === "Completed" ? "opacity-60" : ""} ${overdue ? "border-destructive/40" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Checkbox checked={r.status === "Completed"} onCheckedChange={() => toggleDone(r)} data-testid={`reminder-check-${r.id}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${r.status === "Completed" ? "line-through" : ""}`}>{r.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                      {r.type && <span>{r.type}</span>}
                      {r.due_date && <span className={`flex items-center gap-1 ${overdue ? "text-destructive font-medium" : ""}`}><Clock className="h-3 w-3" />{new Date(r.due_date).toLocaleDateString()} {r.due_time || ""}</span>}
                    </div>
                  </div>
                  <StatusBadge status={r.priority || "Medium"} color={PRIORITY_COLORS[r.priority] || "blue"} />
                  <div className="flex gap-0.5"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(r); setForm(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></Button></div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <FormDialog open={form} onOpenChange={setForm} title={editing ? "Edit Reminder" : "New Reminder"} fields={fields} initial={editing || { priority: "Medium", status: "Pending" }} onSubmit={submit} submitLabel={editing ? "Save" : "Create"} testid="reminder" />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete reminder?" description={`"${del?.title}" will be removed.`} onConfirm={doDelete} />
    </div>
  );
}
