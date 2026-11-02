import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { fmtDate, fmtDateTime } from "@/lib/api";
import { LoadingState, EmptyState } from "@/components/PageStates";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_COLORS } from "@/lib/constants";
import { ApplicationForm } from "@/components/ApplicationForm";
import { AssessmentForm } from "@/components/AssessmentForm";
import { InterviewForm } from "@/components/InterviewForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Trash2, Plus, ExternalLink, Building2, MapPin, Mail, Phone, FileText, ClipboardCheck, CalendarDays, History, Clock } from "lucide-react";
import { toast } from "sonner";

const Field = ({ label, value, href }) => (
  <div>
    <div className="text-xs text-muted-foreground">{label}</div>
    {href && value ? <a href={href} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">{value}<ExternalLink className="h-3 w-3" /></a>
      : <div className="text-sm font-medium mt-0.5">{value || "—"}</div>}
  </div>
);

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [aForm, setAForm] = useState(false);
  const [iForm, setIForm] = useState(false);
  const [editAssess, setEditAssess] = useState(null);
  const [editIv, setEditIv] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get(`/applications/${id}`); setApp(data); }
    catch { toast.error("Application not found"); navigate("/applications"); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async () => { await api.delete(`/applications/${id}`); toast.success("Deleted"); navigate("/applications"); };
  const delAssess = async (aid) => { await api.delete(`/assessments/${aid}`); toast.success("Assessment removed"); load(); };
  const delIv = async (iid) => { await api.delete(`/interviews/${iid}`); toast.success("Interview removed"); load(); };

  if (loading) return <LoadingState rows={6} />;
  if (!app) return null;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate("/applications")} className="mb-4 -ml-2" data-testid="back-btn"><ArrowLeft className="h-4 w-4 mr-1.5" />All Applications</Button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl font-bold" data-testid="detail-title">{app.job_title}</h1>
            <StatusBadge status={app.status} color={STATUS_COLORS[app.status]} testid="detail-status" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground mt-1.5">
            <Building2 className="h-4 w-4" />{app.company_name}
            {app.job_location && <><span className="text-border">·</span><MapPin className="h-4 w-4" />{app.job_location}</>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="detail-edit-btn"><Pencil className="h-4 w-4 mr-1.5" />Edit</Button>
          <Button variant="outline" onClick={() => setDelOpen(true)} className="text-destructive hover:text-destructive" data-testid="detail-delete-btn"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="jd" data-testid="tab-jd">Job Description</TabsTrigger>
          <TabsTrigger value="details" data-testid="tab-details">Application Details</TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">Assessments ({app.assessments.length})</TabsTrigger>
          <TabsTrigger value="interviews" data-testid="tab-interviews">Interviews ({app.interviews.length})</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card><CardContent className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Company" value={app.company_name} />
            <Field label="Website" value={app.company_website} href={app.company_website} />
            <Field label="Industry" value={app.industry} />
            <Field label="Category" value={app.category_name} />
            <Field label="Employment Type" value={app.employment_type} />
            <Field label="Work Arrangement" value={app.work_arrangement} />
            <Field label="Experience" value={app.experience} />
            <Field label="Salary Range" value={app.salary_range} />
            <Field label="Expected CTC" value={app.expected_ctc} />
            <Field label="Application Date" value={fmtDate(app.application_date)} />
            <Field label="Source" value={app.source} />
            <Field label="Reference ID" value={app.reference_id} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="jd" className="mt-4">
          <Card><CardContent className="p-5 space-y-4">
            {app.job_url && <Field label="Job Posting" value={app.job_url} href={app.job_url} />}
            <div><div className="text-xs text-muted-foreground mb-1">Required Skills</div><div className="text-sm">{app.required_skills || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground mb-1">Preferred Skills</div><div className="text-sm">{app.preferred_skills || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground mb-1">Full Job Description</div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-lg p-4 mt-1" data-testid="jd-text">{app.job_description || "No description saved."}</div></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <Card><CardContent className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Field label="Email Used" value={app.email_used} />
            <Field label="Mobile Used" value={app.phone_used} />
            <Field label="Resume Version" value={app.resume_name} />
            <Field label="Cover Letter" value={app.cover_letter} />
            <Field label="Recruiter Name" value={app.recruiter_name} />
            <Field label="Recruiter Email" value={app.recruiter_email} href={app.recruiter_email ? `mailto:${app.recruiter_email}` : null} />
            <Field label="Recruiter Phone" value={app.recruiter_phone} />
            <Field label="Recruiter LinkedIn" value={app.recruiter_linkedin} href={app.recruiter_linkedin} />
            <Field label="Job Portal" value={app.job_portal} />
            <Field label="Follow-up Date" value={fmtDate(app.follow_up_date)} />
            <Field label="Additional Documents" value={app.additional_docs} />
            <Field label="Tags" value={(app.tags || []).join(", ")} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => { setEditAssess(null); setAForm(true); }} data-testid="detail-add-assessment"><Plus className="h-4 w-4 mr-1.5" />Add Assessment</Button></div>
          {app.assessments.length === 0 ? <Card><EmptyState icon={ClipboardCheck} title="No assessments" description="Track coding tests, MCQs and take-home assignments for this application." /></Card> :
            <div className="space-y-3">{app.assessments.map((a) => (
              <Card key={a.id} data-testid={`assessment-card-${a.id}`}><CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{a.name}</span><StatusBadge status={a.status} color={STATUS_COLORS[a.status] || "slate"} /></div>
                  <div className="text-xs text-muted-foreground mt-1">{[a.type, a.platform].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-muted-foreground mt-1">{a.deadline && <>Deadline {fmtDateTime(a.deadline)} · </>}{a.score && `Score ${a.score}${a.max_score ? "/" + a.max_score : ""}`}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditAssess(a); setAForm(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delAssess(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent></Card>))}</div>}
        </TabsContent>

        <TabsContent value="interviews" className="mt-4">
          <div className="flex justify-end mb-3"><Button size="sm" onClick={() => { setEditIv(null); setIForm(true); }} data-testid="detail-add-interview"><Plus className="h-4 w-4 mr-1.5" />Add Interview</Button></div>
          {app.interviews.length === 0 ? <Card><EmptyState icon={CalendarDays} title="No interviews" description="Add interview rounds, schedules and feedback for this application." /></Card> :
            <div className="space-y-3">{app.interviews.map((iv) => (
              <Card key={iv.id} data-testid={`interview-card-${iv.id}`}><CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{iv.round || "Interview"}</span><StatusBadge status={iv.status} color={STATUS_COLORS[iv.status] || "violet"} /></div>
                  <div className="text-xs text-muted-foreground mt-1">{[iv.type, iv.interviewer_name].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDateTime(iv.interview_date)} {iv.timezone && `(${iv.timezone})`}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {iv.meeting_url && <a href={iv.meeting_url} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button></a>}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditIv(iv); setIForm(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => delIv(iv.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent></Card>))}</div>}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card><CardContent className="p-5 space-y-4">
            <div><div className="text-xs text-muted-foreground mb-1">Notes</div><div className="text-sm whitespace-pre-wrap">{app.notes || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground mb-1">Important Instructions</div><div className="text-sm whitespace-pre-wrap">{app.important_instructions || "—"}</div></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card><CardContent className="p-5">
            <div className="space-y-4">
              {(app.history || []).map((h, i) => (
                <div key={h.id || i} className="flex gap-3">
                  <div className="flex flex-col items-center"><span className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />{i < app.history.length - 1 && <span className="w-px flex-1 bg-border" />}</div>
                  <div className="pb-2">
                    <div className="text-sm font-medium">{h.previous_status ? `${h.previous_status} → ${h.new_status}` : h.new_status}</div>
                    {h.notes && <div className="text-xs text-muted-foreground">{h.notes}</div>}
                    <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(h.created_at)}</div>
                  </div>
                </div>
              ))}
              {(app.history || []).length === 0 && <EmptyState icon={History} title="No status history yet" />}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ApplicationForm open={editOpen} onOpenChange={setEditOpen} initial={app} onSaved={load} />
      <AssessmentForm open={aForm} onOpenChange={setAForm} initial={editAssess} fixedApplication={app} onSaved={load} />
      <InterviewForm open={iForm} onOpenChange={setIForm} initial={editIv} fixedApplication={app} onSaved={load} />
      <ConfirmDialog open={delOpen} onOpenChange={setDelOpen} title="Delete application?" description="This also deletes its assessments and interviews. This cannot be undone." onConfirm={doDelete} />
    </div>
  );
}
