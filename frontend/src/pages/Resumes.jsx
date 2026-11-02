import React, { useEffect, useState, useRef } from "react";
import api, { API, fmtDate } from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Plus, Pencil, Trash2, Download, UploadCloud } from "lucide-react";
import { toast } from "sonner";

export default function Resumes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [del, setDel] = useState(null);
  const [form, setForm] = useState({ name: "", target_profile: "", version: "", description: "", skills: "", notes: "" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const load = () => { setLoading(true); api.get("/resumes").then(({ data }) => setItems(data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setForm({ name: "", target_profile: "", version: "", description: "", skills: "", notes: "" }); setFile(null); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, target_profile: r.target_profile || "", version: r.version || "", description: r.description || "", skills: r.skills || "", notes: r.notes || "" }); setFile(null); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Resume name required"); return; }
    setSaving(true);
    try {
      if (editing) { await api.put(`/resumes/${editing.id}`, form); toast.success("Resume updated"); }
      else {
        if (!file) { toast.error("Please choose a PDF or DOCX file"); setSaving(false); return; }
        const fd = new FormData();
        fd.append("file", file);
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        await api.post("/resumes", fd, { headers: { "Content-Type": "multipart/form-data" } });
        toast.success("Resume uploaded");
      }
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); } finally { setSaving(false); }
  };

  const download = async (r) => {
    try {
      const resp = await api.get(`/resumes/${r.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a"); a.href = url; a.download = r.original_filename || r.name; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  const doDelete = async () => { await api.delete(`/resumes/${del.id}`); toast.success("Removed"); setDel(null); load(); };

  return (
    <div>
      <PageHeader title="Resume Library" subtitle="Keep every resume version and see which applications used it.">
        <Button onClick={openNew} data-testid="add-resume-btn"><Plus className="h-4 w-4 mr-1.5" />Upload Resume</Button>
      </PageHeader>

      {loading ? <LoadingState /> : items.length === 0 ? (
        <Card><EmptyState icon={FileText} title="No resumes yet" description="Upload PDF or DOCX resume versions and link them to applications." action={<Button onClick={openNew}><UploadCloud className="h-4 w-4 mr-1.5" />Upload Resume</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((r) => (
            <Card key={r.id} data-testid={`resume-card-${r.id}`}><CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-lg bg-primary/10 grid place-items-center shrink-0"><FileText className="h-5 w-5 text-primary" /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.name}{r.version ? ` v${r.version}` : ""}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.target_profile || "General"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.usage_count} application{r.usage_count === 1 ? "" : "s"} · {fmtDate(r.created_at)}</div>
                </div>
              </div>
              {r.description && <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{r.description}</p>}
              <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => download(r)} data-testid={`download-resume-${r.id}`}><Download className="h-3.5 w-3.5 mr-1" />Download</Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDel(r)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-h-[90vh] overflow-y-auto" data-testid="resume-dialog">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Resume" : "Upload Resume"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div>
                <Label className="text-xs mb-1.5 block">Resume File (PDF / DOCX)</Label>
                <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" data-testid="resume-dropzone">
                  <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <div className="text-sm">{file ? file.name : "Click to choose a file"}</div>
                </div>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={(e) => setFile(e.target.files[0])} data-testid="resume-file-input" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs mb-1.5 block">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="resume-name-input" /></div>
              <div><Label className="text-xs mb-1.5 block">Target Profile</Label><Input value={form.target_profile} onChange={(e) => setForm({ ...form, target_profile: e.target.value })} /></div>
              <div><Label className="text-xs mb-1.5 block">Version</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 2" /></div>
              <div className="col-span-2"><Label className="text-xs mb-1.5 block">Relevant Skills</Label><Input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></div>
              <div className="col-span-2"><Label className="text-xs mb-1.5 block">Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
              <div className="col-span-2"><Label className="text-xs mb-1.5 block">Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving} data-testid="save-resume-btn">{saving ? "Saving…" : editing ? "Save" : "Upload"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete resume?" description={`"${del?.name}" will be removed from your library.`} onConfirm={doDelete} />
    </div>
  );
}
