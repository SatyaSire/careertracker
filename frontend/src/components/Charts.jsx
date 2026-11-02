import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const CHART_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#a855f7"];

const tooltipStyle = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, color: "hsl(var(--popover-foreground))" },
  itemStyle: { color: "hsl(var(--popover-foreground))" },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
};

const ChartShell = ({ title, children, action, empty, testid }) => (
  <Card data-testid={testid}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-base font-display">{title}</CardTitle>
      {action}
    </CardHeader>
    <CardContent>
      {empty ? (
        <div className="h-[240px] grid place-items-center text-sm text-muted-foreground">No data yet</div>
      ) : children}
    </CardContent>
  </Card>
);

export const BarChartCard = ({ title, data, color = "#6366f1", testid, horizontal }) => (
  <ChartShell title={title} empty={!data?.length} testid={testid}>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 10 : 0, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
          </>
        )}
        <Tooltip {...tooltipStyle} cursor={{ fill: "hsl(var(--muted))" }} />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </ChartShell>
);

export const PieChartCard = ({ title, data, testid }) => {
  const nonZero = (data || []).filter((d) => d.value > 0);
  return (
    <ChartShell title={title} empty={!nonZero.length} testid={testid}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={nonZero} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={85} innerRadius={50} paddingAngle={2}>
            {nonZero.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
        {nonZero.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {d.label} <span className="font-medium text-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </ChartShell>
  );
};

export const LineChartCard = ({ title, data, action, testid }) => (
  <ChartShell title={title} action={action} empty={!data?.length} testid={testid}>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  </ChartShell>
);

export const FunnelCard = ({ title, data, testid }) => {
  const max = Math.max(...(data || []).map((d) => d.value), 1);
  return (
    <ChartShell title={title} empty={!data?.some((d) => d.value > 0)} testid={testid}>
      <div className="space-y-2.5 py-2">
        {(data || []).map((d, i) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-24 text-xs text-muted-foreground shrink-0">{d.label}</span>
            <div className="flex-1 bg-muted rounded-md h-7 overflow-hidden">
              <div className="h-full rounded-md flex items-center justify-end px-2 text-xs font-semibold text-white transition-all"
                style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 12 : 0)}%`, background: CHART_COLORS[i % CHART_COLORS.length], minWidth: d.value > 0 ? 28 : 0 }}>
                {d.value > 0 ? d.value : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartShell>
  );
};
