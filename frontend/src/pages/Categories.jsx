import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tags, Plus, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#6366f1", "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#14b8a6", "#f59e0b", "#f97316", "#ec4899", "#a855f7", "#84cc16", "#ef4444", "#0ea5e9", "#64748b"];

export default function Categories() {
  const navigate = useNavigate();
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [delTarget, setDelTarget] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = () => { setLoading(true); api.get("/categories").then(({ data }) => setCats(data)).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setEditing(null); setName(""); setColor(COLORS[0]); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setName(c.name); setColor(c.color); setOpen(true); };

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    try {
      if (editing) await api.put(`/categories/${editing.id}`, { name, color });
      else await api.post("/categories", { name, color });
      toast.success(editing ? "Category updated" : "Category created");
      setOpen(false); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const toggleArchive = async (c) => { await api.put(`/categories/${c.id}`, { archived: !c.archived }); load(); };
  const doDelete = async () => {
    try { await api.delete(`/categories/${delTarget.id}`); toast.success("Deleted"); setDelTarget(null); load(); }
    catch (e) { toast.error(e?.response?.data?.detail || "Cannot delete"); setDelTarget(null); }
  };

  const visible = cats.filter((c) => showArchived || !c.archived);

  return (
    <div>
      <PageHeader title="Job Categories" subtitle="Organize applications by profile. Create, recolor and archive freely.">
        <div className="flex items-center gap-2 mr-2"><Switch checked={showArchived} onCheckedChange={setShowArchived} data-testid="toggle-archived" /><span className="text-sm text-muted-foreground">Show archived</span></div>
        <Button onClick={openNew} data-testid="add-category-btn"><Plus className="h-4 w-4 mr-1.5" />New Category</Button>
      </PageHeader>

      {loading ? <LoadingState /> : visible.length === 0 ? (
        <Card><EmptyState icon={Tags} title="No categories" description="Create your first job category." action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />New Category</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((c) => (
            <Card key={c.id} className={c.archived ? "opacity-60" : ""} data-testid={`category-card-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <button onClick={() => navigate(`/applications?category_id=${c.id}`)} className="flex items-center gap-2.5 text-left group">
                    <span className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `${c.color}22` }}><span className="h-3.5 w-3.5 rounded-full" style={{ background: c.color }} /></span>
                    <div>
                      <div className="font-medium group-hover:text-primary transition-colors">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.application_count} application{c.application_count === 1 ? "" : "s"}</div>
                    </div>
                  </button>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} data-testid={`edit-category-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleArchive(c)}>{c.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDelTarget(c)} data-testid={`delete-category-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card" data-testid="category-dialog">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Category" : "New Category"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="text-xs mb-1.5 block">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. DevOps Engineering" data-testid="category-name-input" /></div>
            <div><Label className="text-xs mb-2 block">Color</Label>
              <div className="flex flex-wrap gap-2">{COLORS.map((cl) => (
                <button key={cl} onClick={() => setColor(cl)} className={`h-8 w-8 rounded-lg transition-transform ${color === cl ? "ring-2 ring-offset-2 ring-offset-card ring-foreground scale-110" : ""}`} style={{ background: cl }} />
              ))}</div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} data-testid="save-category-btn">{editing ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)} title="Delete category?" description={`"${delTarget?.name}" will be removed. Categories in use can't be deleted — archive them instead.`} onConfirm={doDelete} />
    </div>
  );
}
