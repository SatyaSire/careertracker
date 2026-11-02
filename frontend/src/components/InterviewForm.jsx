import React, { useEffect, useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import api from "@/lib/api";
import { INTERVIEW_ROUNDS, INTERVIEW_TYPES, INTERVIEW_STATUSES } from "@/lib/constants";
import { toast } from "sonner";

export function InterviewForm({ open, onOpenChange, initial, fixedApplication, onSaved }) {
  const [apps, setApps] = useState([]);
  useEffect(() => {
    if (open && !fixedApplication) api.get("/applications", { params: { page_size: 500 } }).then(({ data }) => setApps(data.items));
  }, [open, fixedApplication]);

  const appOptions = apps.map((a) => ({ value: a.id, label: `${a.job_title} — ${a.company_name}` }));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fields = [
    ...(fixedApplication ? [] : [{ name: "application_id", label: "Linked Application", type: "select", options: appOptions, colSpan: 2 }]),
    { name: "company_name", label: "Company" },
    { name: "job_title", label: "Job Title" },
    { name: "round", label: "Interview Round", type: "select", options: INTERVIEW_ROUNDS },
    { name: "type", label: "Interview Type", type: "select", options: INTERVIEW_TYPES },
    { name: "status", label: "Status", type: "select", options: INTERVIEW_STATUSES },
    { name: "result", label: "Result" },
    { name: "interview_date", label: "Interview Date & Time", type: "datetime-local", colSpan: 2 },
    { name: "start_time", label: "Start Time", type: "time" },
    { name: "end_time", label: "End Time", type: "time" },
    { name: "timezone", label: "Time Zone", placeholder: tz },
    { name: "platform", label: "Meeting Platform", placeholder: "Zoom, Meet, Teams…" },
    { name: "meeting_url", label: "Meeting URL", colSpan: 2, placeholder: "https://" },
    { name: "interviewer_name", label: "Interviewer Name" },
    { name: "interviewer_email", label: "Interviewer Email", type: "email" },
    { name: "questions", label: "Questions Asked", type: "textarea", colSpan: 2 },
    { name: "preparation_notes", label: "Preparation Notes", type: "textarea", colSpan: 2 },
    { name: "next_steps", label: "Next Steps", type: "textarea", colSpan: 2 },
    { name: "feedback", label: "Feedback", type: "textarea", colSpan: 2 },
  ];

  const submit = async (values) => {
    const payload = { ...values, timezone: values.timezone || tz };
    if (fixedApplication) { payload.application_id = fixedApplication.id; payload.company_name = payload.company_name || fixedApplication.company_name; payload.job_title = payload.job_title || fixedApplication.job_title; }
    try {
      if (initial?.id) { await api.put(`/interviews/${initial.id}`, payload); toast.success("Interview updated"); }
      else { await api.post("/interviews", payload); toast.success("Interview added"); }
      onSaved?.();
    } catch (e) { toast.error("Failed to save"); throw e; }
  };

  return <FormDialog open={open} onOpenChange={onOpenChange} title={initial?.id ? "Edit Interview" : "New Interview"}
    fields={fields} initial={initial || { status: "Scheduled", timezone: tz }} onSubmit={submit} submitLabel={initial?.id ? "Save" : "Add Interview"} testid="interview" />;
}
