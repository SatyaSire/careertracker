import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import { PageHeader, EmptyState, LoadingState } from "@/components/PageStates";
import { ApplicationForm } from "@/components/ApplicationForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_COLORS, APPLICATION_STATUSES, WORK_ARRANGEMENTS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Briefcase, MoreVertical, Copy, Pencil, Trash2, Eye, X } from "lucide-react";
import { fmtDate } from "@/lib/api";
import { toast } from "sonner";

const ALL = "__all__";

export default function Applications() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [loading, setLoading] = useState(true);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState(sp.get("search") || "");
  const [filters, setFilters] = useState({
    status: sp.get("status") || "", category_id: sp.get("category_id") || "",
    work_arrangement: sp.get("work_arrangement") || "", sort: sp.get("sort") || "newest",
  });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [delTarget, setDelTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 20, sort: filters.sort };
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.work_arrangement) params.work_arrangement = filters.work_arrangement;
      const { data } = await api.get("/applications", { params });
      setData(data);
    } finally { setLoading(false); }
  }, [page, filters, search]);

  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data)); }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const setFilter = (k, v) => { setFilters((p) => ({ ...p, [k]: v === ALL ? "" : v })); setPage(1); };
  const clearFilters = () => { setFilters({ status: "", category_id: "", work_arrangement: "", sort: "newest" }); setSearch(""); setPage(1); setSp({}); };
  const hasFilters = search || filters.status || filters.category_id || filters.work_arrangement;

  const duplicate = async (id) => { await api.post(`/applications/${id}/duplicate`); toast.success("Application duplicated"); load(); };
  const doDelete = async () => { await api.delete(`/applications/${delTarget.id}`); toast.success("Application deleted"); setDelTarget(null); load(); };

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return (
    <div>
      <PageHeader title="All Applications" subtitle={`${data.total} application${data.total === 1 ? "" : "s"} tracked`}>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="add-application-btn"><Plus className="h-4 w-4 mr-1.5" />New Application</Button>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search company, title, description, email, recruiter…" className="pl-9" data-testid="application-search" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filters.status || ALL} onValueChange={(v) => setFilter("status", v)}>
            <SelectTrigger className="w-[150px]" data-testid="filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="bg-popover max-h-72"><SelectItem value={ALL}>All Statuses</SelectItem>{APPLICATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.category_id || ALL} onValueChange={(v) => setFilter("category_id", v)}>
            <SelectTrigger className="w-[150px]" data-testid="filter-category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent className="bg-popover max-h-72"><SelectItem value={ALL}>All Categories</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.work_arrangement || ALL} onValueChange={(v) => setFilter("work_arrangement", v)}>
            <SelectTrigger className="w-[130px]" data-testid="filter-arrangement"><SelectValue placeholder="Work" /></SelectTrigger>
            <SelectContent className="bg-popover"><SelectItem value={ALL}>All</SelectItem>{WORK_ARRANGEMENTS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => setFilter("sort", v)}>
            <SelectTrigger className="w-[130px]" data-testid="filter-sort"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover"><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem><SelectItem value="company">Company</SelectItem><SelectItem value="status">Status</SelectItem></SelectContent>
          </Select>
          {hasFilters && <Button variant="ghost" onClick={clearFilters} data-testid="clear-filters"><X className="h-4 w-4 mr-1" />Clear</Button>}
        </div>
      </div>

      {loading ? <LoadingState /> : data.items.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={Briefcase} title={hasFilters ? "No matching applications" : "No applications yet"}
            description={hasFilters ? "Try adjusting your search or filters." : "Add your first job application to start tracking your career pipeline."}
            action={!hasFilters && <Button onClick={() => { setEditing(null); setFormOpen(true); }} data-testid="empty-add-btn"><Plus className="h-4 w-4 mr-1.5" />New Application</Button>} />
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Company / Role</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Work</TableHead>
                  <TableHead className="hidden sm:table-cell">Applied</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" data-testid={`application-row-${a.id}`} onClick={() => navigate(`/applications/${a.id}`)}>
                    <TableCell>
                      <div className="font-medium">{a.job_title || "Untitled role"}</div>
                      <div className="text-xs text-muted-foreground">{a.company_name}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {a.category_name ? <span className="inline-flex items-center gap-1.5 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: a.category_color || "#6366f1" }} />{a.category_name}</span> : <span className="text-muted-foreground text-sm">—</span>}
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} color={STATUS_COLORS[a.status]} testid={`status-${a.id}`} /></TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{a.work_arrangement || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{fmtDate(a.application_date)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`row-menu-${a.id}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover">
                          <DropdownMenuItem onClick={() => navigate(`/applications/${a.id}`)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(a); setFormOpen(true); }} data-testid={`edit-${a.id}`}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(a.id)}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDelTarget(a)} className="text-destructive focus:text-destructive" data-testid={`delete-${a.id}`}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-xs text-muted-foreground">Page {data.page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="prev-page">Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="next-page">Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ApplicationForm open={formOpen} onOpenChange={setFormOpen} initial={editing} onSaved={load} />
      <ConfirmDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)} title="Delete application?"
        description={`This permanently deletes "${delTarget?.job_title}" at ${delTarget?.company_name}, along with its assessments and interviews.`}
        onConfirm={doDelete} />
    </div>
  );
}
