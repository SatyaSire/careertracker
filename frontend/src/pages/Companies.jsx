import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Pencil, Trash2, Globe, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

export default function Companies() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, apps] = await Promise.all([api.get("/companies"), api.get("/applications", { params: { page_size: 1000 } })]);
    setItems(c.data);
    const cnt = {};
    apps.data.items.forEach((a) => { if (a.company_name) cnt[a.company_name.toLowerCase()] = (cnt[a.company_name.toLowerCase()] || 0) + 1; });
    setCounts(cnt);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const fields = [
    { name: "name", label: "Company Name", required: true, colSpan: 2 },
    { name: "website", label: "Website", placeholder: "https://" },
    { name: "industry", label: "Industry" },
    { name: "location", label: "Location" },
    { name: "linkedin", label: "LinkedIn URL" },
    { name: "recruiter_info", label: "Recruiter Information", colSpan: 2 },
    { name: "notes", label: "Notes", type: "textarea", colSpan: 2 },
  ];

  const submit = async (values) => {
    try { if (editing) await api.put(`/companies/${editing.id}`, values); else await api.post("/companies", values); toast.success(editing ? "Updated" : "Created"); load(); }
    catch { toast.error("Failed"); throw new Error(); }
  };
  const doDelete = async () => { await api.delete(`/companies/${del.id}`); toast.success("Deleted"); setDel(null); load(); };

  const filtered = items.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Companies" subtitle="Your company directory, auto-populated from applications.">
        <Button onClick={() => { setEditing(null); setForm(true); }} data-testid="add-company-btn"><Plus className="h-4 w-4 mr-1.5" />New Company</Button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="pl-9" data-testid="company-search" /></div>

      {loading ? <LoadingState /> : filtered.length === 0 ? (
        <Card><EmptyState icon={Building2} title="No companies" description="Companies appear here automatically when you add applications." action={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-1.5" />New Company</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} data-testid={`company-card-${c.id}`}><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5"><span className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center font-display font-bold text-primary">{c.name[0]?.toUpperCase()}</span><div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.industry || "—"}</div></div></div>
                <div className="flex gap-0.5"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setForm(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
              <div className="space-y-1.5 mt-3 text-sm text-muted-foreground">
                {c.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{c.location}</div>}
                {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary"><Globe className="h-3.5 w-3.5" />Website</a>}
              </div>
              <button onClick={() => navigate(`/applications?company=${encodeURIComponent(c.name)}`)} className="text-xs text-primary hover:underline mt-3">{counts[c.name.toLowerCase()] || 0} application{(counts[c.name.toLowerCase()] || 0) === 1 ? "" : "s"}</button>
            </CardContent></Card>
          ))}
        </div>
      )}
      <FormDialog open={form} onOpenChange={setForm} title={editing ? "Edit Company" : "New Company"} fields={fields} initial={editing || {}} onSubmit={submit} submitLabel={editing ? "Save" : "Create"} testid="company" />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete company?" description={`"${del?.name}" will be removed from your directory.`} onConfirm={doDelete} />
    </div>
  );
}
