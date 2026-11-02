import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { fmtDate, fmtDateTime } from "@/lib/api";
import { PageHeader, LoadingState } from "@/components/PageStates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Briefcase, CalendarClock, Activity, ClipboardCheck, ClipboardList, CheckCircle2,
  CalendarCheck, CalendarDays, Award, XCircle, Clock, Bell, AlertTriangle, ChevronRight,
} from "lucide-react";

const KPI = ({ icon: Icon, label, value, tone = "indigo", onClick, testid }) => {
  const tones = {
    indigo: "text-indigo-500 bg-indigo-500/10", blue: "text-blue-500 bg-blue-500/10",
    emerald: "text-emerald-500 bg-emerald-500/10", amber: "text-amber-500 bg-amber-500/10",
    red: "text-red-500 bg-red-500/10", violet: "text-violet-500 bg-violet-500/10", slate: "text-slate-500 bg-slate-500/10",
  };
  return (
    <button onClick={onClick} data-testid={testid}
      className="text-left rounded-xl border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all group">
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-[18px] w-[18px]" /></div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="mt-3 font-display text-2xl font-bold" data-testid={`${testid}-value`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </button>
  );
};

export default function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/kpis").then(({ data }) => setKpis(data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div><PageHeader title="Overview" subtitle="Your recruitment at a glance" /><LoadingState rows={4} /></div>;

  const att = kpis?.attention || {};
  const attItems = [
    { key: "overdue_assessments", label: "Overdue assessments", icon: ClipboardCheck, tone: "red", list: att.overdue_assessments, render: (i) => `${i.name || "Assessment"} · due ${fmtDate(i.deadline)}`, link: (i) => i.application_id && `/applications/${i.application_id}` },
    { key: "due_soon_assessments", label: "Assessments due soon", icon: Clock, tone: "amber", list: att.due_soon_assessments, render: (i) => `${i.name || "Assessment"} · due ${fmtDate(i.deadline)}`, link: (i) => i.application_id && `/applications/${i.application_id}` },
    { key: "scheduled_interviews", label: "Interviews scheduled", icon: CalendarCheck, tone: "violet", list: att.scheduled_interviews, render: (i) => `${i.round || "Interview"} @ ${i.company || ""} · ${fmtDateTime(i.interview_date)}`, link: (i) => i.application_id && `/applications/${i.application_id}` },
    { key: "overdue_followups", label: "Follow-ups overdue", icon: Bell, tone: "red", list: att.overdue_followups, render: (i) => `${i.title} · ${fmtDate(i.due_date)}`, link: () => "/reminders" },
    { key: "stale_applications", label: "Applications without updates", icon: AlertTriangle, tone: "slate", list: att.stale_applications, render: (i) => `${i.job_title || "Role"} @ ${i.company || ""}`, link: (i) => `/applications/${i.id}` },
  ].filter((s) => (s.list || []).length > 0);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Your career applications, at a glance — all figures from live records." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPI icon={Briefcase} label="Total Applications" value={kpis.total_applications} tone="indigo" testid="kpi-total" onClick={() => navigate("/applications")} />
        <KPI icon={CalendarDays} label="This Month" value={kpis.applications_this_month} tone="blue" testid="kpi-month" onClick={() => navigate("/applications?sort=newest")} />
        <KPI icon={Activity} label="Active Applications" value={kpis.active_applications} tone="violet" testid="kpi-active" onClick={() => navigate("/applications")} />
        <KPI icon={Clock} label="Awaiting Response" value={kpis.applications_awaiting_response} tone="amber" testid="kpi-awaiting" onClick={() => navigate("/applications?status=Applied")} />
        <KPI icon={ClipboardList} label="Assessments Received" value={kpis.assessments_received} tone="indigo" testid="kpi-assess-received" onClick={() => navigate("/assessments")} />
        <KPI icon={ClipboardCheck} label="Assessments Pending" value={kpis.assessments_pending} tone="amber" testid="kpi-assess-pending" onClick={() => navigate("/assessments?status=Pending")} />
        <KPI icon={CheckCircle2} label="Assessments Completed" value={kpis.assessments_completed} tone="emerald" testid="kpi-assess-done" onClick={() => navigate("/assessments?status=Completed")} />
        <KPI icon={CalendarCheck} label="Upcoming Interviews" value={kpis.upcoming_interviews} tone="violet" testid="kpi-upcoming-iv" onClick={() => navigate("/interviews")} />
        <KPI icon={CalendarDays} label="Interviews Completed" value={kpis.interviews_completed} tone="blue" testid="kpi-done-iv" onClick={() => navigate("/interviews?status=Completed")} />
        <KPI icon={Award} label="Offers Received" value={kpis.offers_received} tone="emerald" testid="kpi-offers" onClick={() => navigate("/applications?status=Offer Received")} />
        <KPI icon={XCircle} label="Rejected" value={kpis.applications_rejected} tone="red" testid="kpi-rejected" onClick={() => navigate("/applications?status=Rejected")} />
        <KPI icon={Bell} label="Follow-ups Due" value={kpis.followups_due} tone="amber" testid="kpi-followups" onClick={() => navigate("/reminders")} />
      </div>

      <div className="mt-8">
        <Card data-testid="attention-section">
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base font-display">Attention Required</CardTitle>
          </CardHeader>
          <CardContent>
            {attItems.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> You're all caught up. Nothing needs attention right now.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {attItems.map((s) => (
                  <div key={s.key} className="rounded-lg border bg-background/50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon className={`h-4 w-4 text-${s.tone}-500`} />
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="ml-auto text-xs rounded-full bg-muted px-2 py-0.5">{s.list.length}</span>
                    </div>
                    <div className="space-y-1">
                      {s.list.slice(0, 4).map((i, idx) => {
                        const link = s.link(i);
                        return (
                          <button key={idx} onClick={() => link && navigate(link)} data-testid={`attention-${s.key}-${idx}`}
                            className="w-full text-left text-xs text-muted-foreground hover:text-foreground truncate py-0.5">
                            {s.render(i)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
