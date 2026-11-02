import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { FormDialog } from "@/components/FormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export default function Contacts() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, apps] = await Promise.all([api.get("/contacts"), api.get("/applications", { params: { page_size: 1000 } })]);
    setItems(c.data);
    const cnt = {};
    apps.data.items.forEach((a) => { if (a.email_used) cnt[a.email_used] = (cnt[a.email_used] || 0) + 1; });
    setCounts(cnt);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const fields = [
    { name: "name", label: "Profile Name", required: true, colSpan: 2 },
    { name: "email", label: "Email Address", type: "email" },
    { name: "mobile", label: "Mobile Number" },
    { name: "secondary_email", label: "Secondary Email", type: "email" },
    { name: "secondary_mobile", label: "Secondary Mobile" },
    { name: "description", label: "Description", type: "textarea", colSpan: 2 },
  ];

  const submit = async (values) => {
    try {
      if (editing) await api.put(`/contacts/${editing.id}`, values);
      else await api.post("/contacts", values);
      toast.success(editing ? "Contact updated" : "Contact created");
      load();
    } catch { toast.error("Failed"); throw new Error(); }
  };
  const doDelete = async () => { await api.delete(`/contacts/${del.id}`); toast.success("Deleted"); setDel(null); load(); };

  return (
    <div>
      <PageHeader title="Accounts & Contact Profiles" subtitle="Reusable email + phone combinations used across applications.">
        <Button onClick={() => { setEditing(null); setForm(true); }} data-testid="add-contact-btn"><Plus className="h-4 w-4 mr-1.5" />New Profile</Button>
      </PageHeader>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <Card><EmptyState icon={Users} title="No contact profiles" description="Create profiles for each email/phone you apply with." action={<Button onClick={() => setForm(true)}><Plus className="h-4 w-4 mr-1.5" />New Profile</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => (
            <Card key={c.id} data-testid={`contact-card-${c.id}`}><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2"><span className="font-medium">{c.name}</span>{c.active === false && <Badge variant="secondary" className="text-xs">Inactive</Badge>}</div>
                <div className="flex gap-0.5"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(c); setForm(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
              <div className="space-y-1.5 mt-3 text-sm">
                {c.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" />{c.email}</div>}
                {c.mobile && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{c.mobile}</div>}
              </div>
              {c.email && <button onClick={() => navigate(`/applications?search=${encodeURIComponent(c.email)}`)} className="text-xs text-primary hover:underline mt-3">{counts[c.email] || 0} application{(counts[c.email] || 0) === 1 ? "" : "s"} used this email</button>}
            </CardContent></Card>
          ))}
        </div>
      )}
      <FormDialog open={form} onOpenChange={setForm} title={editing ? "Edit Contact Profile" : "New Contact Profile"} fields={fields} initial={editing || {}} onSubmit={submit} submitLabel={editing ? "Save" : "Create"} testid="contact" />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete contact profile?" description={`"${del?.name}" will be removed. Past applications keep their recorded email and phone.`} onConfirm={doDelete} />
    </div>
  );
}
