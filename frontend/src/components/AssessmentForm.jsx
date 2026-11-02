import React, { useEffect, useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import api from "@/lib/api";
import { ASSESSMENT_TYPES, ASSESSMENT_STATUSES, ASSESSMENT_RESULTS } from "@/lib/constants";
import { toast } from "sonner";

export function AssessmentForm({ open, onOpenChange, initial, fixedApplication, onSaved }) {
  const [apps, setApps] = useState([]);
  useEffect(() => {
    if (open && !fixedApplication) api.get("/applications", { params: { page_size: 500 } }).then(({ data }) => setApps(data.items));
  }, [open, fixedApplication]);

  const appOptions = apps.map((a) => ({ value: a.id, label: `${a.job_title} — ${a.company_name}` }));

  const fields = [
    ...(fixedApplication ? [] : [{ name: "application_id", label: "Linked Application", type: "select", options: appOptions, colSpan: 2 }]),
    { name: "name", label: "Assessment Name", required: true, colSpan: 2 },
    { name: "company_name", label: "Company" },
    { name: "type", label: "Assessment Type", type: "select", options: ASSESSMENT_TYPES },
    { name: "platform", label: "Platform", placeholder: "HackerRank, Codility…" },
    { name: "url", label: "Assessment URL", placeholder: "https://" },
    { name: "status", label: "Status", type: "select", options: ASSESSMENT_STATUSES },
    { name: "result", label: "Result", type: "select", options: ASSESSMENT_RESULTS },
    { name: "date_received", label: "Date Received", type: "date" },
    { name: "deadline", label: "Deadline", type: "datetime-local" },
    { name: "scheduled_date", label: "Scheduled Date", type: "datetime-local" },
    { name: "completion_date", label: "Completion Date", type: "date" },
    { name: "score", label: "Score" },
    { name: "max_score", label: "Maximum Score" },
    { name: "instructions", label: "Instructions", type: "textarea", colSpan: 2 },
    { name: "preparation_notes", label: "Preparation Notes", type: "textarea", colSpan: 2 },
    { name: "feedback", label: "Feedback", type: "textarea", colSpan: 2 },
  ];

  const submit = async (values) => {
    const payload = { ...values };
    if (fixedApplication) { payload.application_id = fixedApplication.id; payload.company_name = payload.company_name || fixedApplication.company_name; }
    try {
      if (initial?.id) { await api.put(`/assessments/${initial.id}`, payload); toast.success("Assessment updated"); }
      else { await api.post("/assessments", payload); toast.success("Assessment added"); }
      onSaved?.();
    } catch (e) { toast.error("Failed to save"); throw e; }
  };

  return <FormDialog open={open} onOpenChange={onOpenChange} title={initial?.id ? "Edit Assessment" : "New Assessment"}
    fields={fields} initial={initial || { status: "Received" }} onSubmit={submit} submitLabel={initial?.id ? "Save" : "Add Assessment"} testid="assessment" />;
}
