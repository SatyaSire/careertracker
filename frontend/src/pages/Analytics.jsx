import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader, LoadingState } from "@/components/PageStates";
import { BarChartCard, PieChartCard, LineChartCard, FunnelCard } from "@/components/Charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPLICATION_STATUSES, APPLICATION_SOURCES } from "@/lib/constants";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

const ALL = "__all";
const EMPTY_DATA = {
  total: 0, over_time_monthly: [], over_time_weekly: [], by_category: [], by_company: [], by_source: [],
  funnel: [], outcomes: [], assessment_stats: [], interview_stats: [], profile_performance: [],
  rates: { assessment_completion_pct: 0, assessment_pass_pct: 0, application_to_interview_pct: 0, interview_to_offer_pct: 0, rejection_pct: 0 },
};
const EMPTY = { date_from: "", date_to: "", category_id: ALL, company: "", status: ALL, source: ALL };

const FilterSelect = ({ value, onChange, placeholder, items, testid }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-full" data-testid={testid}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      <SelectItem value={ALL}>{placeholder}</SelectItem>
      {items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

const Rate = ({ label, value, testid }) => (
  <div className="rounded-xl border bg-card p-4" data-testid={testid}>
    <div className="font-display text-2xl font-bold">{value}%</div>
    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
  </div>
);

export default function Analytics() {
  const [filters, setFilters] = useState(EMPTY);
  const [cats, setCats] = useState([]);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("monthly");

  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data)).catch(() => {}); }, []);

  useEffect(() => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== ALL) params[k] = v; });
    api.get("/analytics", { params }).then(({ data }) => setData(data))
      .catch(() => { toast.error("Could not load analytics"); setData(EMPTY_DATA); });
  }, [filters]);

  const set = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));
  const statusItems = APPLICATION_STATUSES.map((s) => ({ value: s.value ?? s, label: s.label ?? s }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Recruitment intelligence across all your applications." />
      <Card className="mb-6">
        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
          <Input type="date" value={filters.date_from} onChange={(e) => set("date_from")(e.target.value)} data-testid="analytics-date-from" />
          <Input type="date" value={filters.date_to} onChange={(e) => set("date_to")(e.target.value)} data-testid="analytics-date-to" />
          <FilterSelect value={filters.category_id} onChange={set("category_id")} placeholder="All categories" items={cats.map((c) => ({ value: c.id, label: c.name }))} testid="analytics-category" />
          <Input placeholder="Company" value={filters.company} onChange={(e) => set("company")(e.target.value)} data-testid="analytics-company" />
          <FilterSelect value={filters.status} onChange={set("status")} placeholder="All statuses" items={statusItems} testid="analytics-status" />
          <FilterSelect value={filters.source} onChange={set("source")} placeholder="All sources" items={APPLICATION_SOURCES.map((s) => ({ value: s, label: s }))} testid="analytics-source" />
          <Button variant="outline" onClick={() => setFilters(EMPTY)} data-testid="analytics-reset"><RotateCcw className="h-4 w-4 mr-2" />Reset</Button>
        </CardContent>
      </Card>

      {!data ? <LoadingState rows={4} /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="rounded-xl border bg-card p-4" data-testid="analytics-total">
              <div className="font-display text-2xl font-bold">{data.total}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Applications (filtered)</div>
            </div>
            <Rate label="Assessment completion" value={data.rates.assessment_completion_pct} testid="rate-assess-completion" />
            <Rate label="Assessment pass rate" value={data.rates.assessment_pass_pct} testid="rate-assess-pass" />
            <Rate label="Application → interview" value={data.rates.application_to_interview_pct} testid="rate-app-interview" />
            <Rate label="Interview → offer" value={data.rates.interview_to_offer_pct} testid="rate-interview-offer" />
            <Rate label="Rejection rate" value={data.rates.rejection_pct} testid="rate-rejection" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <LineChartCard title="Applications over time" testid="chart-over-time"
              data={period === "monthly" ? data.over_time_monthly : data.over_time_weekly}
              action={
                <div className="flex gap-1">
                  {["monthly", "weekly"].map((p) => (
                    <Button key={p} size="sm" variant={period === p ? "default" : "ghost"} onClick={() => setPeriod(p)} data-testid={`period-${p}`} className="capitalize h-7">{p}</Button>
                  ))}
                </div>
              } />
            <FunnelCard title="Recruitment funnel" data={data.funnel} testid="chart-funnel" />
            <PieChartCard title="By category" data={data.by_category} testid="chart-category" />
            <PieChartCard title="Outcomes" data={data.outcomes} testid="chart-outcomes" />
            <BarChartCard title="Top companies" data={data.by_company} horizontal testid="chart-company" />
            <BarChartCard title="By source" data={data.by_source} color="#3b82f6" testid="chart-source" />
            <BarChartCard title="Assessment status" data={data.assessment_stats} color="#f59e0b" testid="chart-assessments" />
            <BarChartCard title="Interview status" data={data.interview_stats} color="#8b5cf6" testid="chart-interviews" />
          </div>

          <Card data-testid="profile-performance">
            <CardHeader><CardTitle className="text-base font-display">Profile performance by category</CardTitle></CardHeader>
            <CardContent>
              {data.profile_performance.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">No categorized applications yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-4 font-medium">Category</th><th className="py-2 pr-4 font-medium">Applications</th>
                      <th className="py-2 pr-4 font-medium">Interviews</th><th className="py-2 font-medium">Offers</th>
                    </tr></thead>
                    <tbody>
                      {data.profile_performance.map((p) => (
                        <tr key={p.category} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{p.category}</td><td className="py-2 pr-4">{p.applications}</td>
                          <td className="py-2 pr-4">{p.interviews}</td><td className="py-2">{p.offers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
