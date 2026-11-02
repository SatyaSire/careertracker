import React, { useEffect, useState } from "react";
import { FormDialog } from "@/components/FormDialog";
import api from "@/lib/api";
import { APPLICATION_STATUSES, EMPLOYMENT_TYPES, WORK_ARRANGEMENTS, APPLICATION_SOURCES } from "@/lib/constants";
import { toast } from "sonner";

// Dialog that loads categories/resumes/contacts then renders a schema-driven application form.
export function ApplicationForm({ open, onOpenChange, initial, onSaved }) {
  const [opts, setOpts] = useState({ categories: [], resumes: [], contacts: [] });

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get("/categories", { params: { include_archived: false } }),
      api.get("/resumes"),
      api.get("/contacts"),
    ]).then(([c, r, ct]) => setOpts({ categories: c.data, resumes: r.data, contacts: ct.data })).catch(() => {});
  }, [open]);

  const contactPairs = opts.contacts.map((c) => ({ value: `${c.email || ""}||${c.mobile || ""}`, label: `${c.name} (${c.email || "no email"} / ${c.mobile || "no phone"})` }));

  const fields = [
    { section: "Company", name: "company_name", label: "Company Name", required: true, colSpan: 2, placeholder: "e.g. Acme Corp" },
    { section: "Company", name: "company_website", label: "Website", placeholder: "https://" },
    { section: "Company", name: "company_location", label: "Company Location" },
    { section: "Company", name: "company_linkedin", label: "Company LinkedIn" },
    { section: "Company", name: "industry", label: "Industry" },
    { section: "Company", name: "company_notes", label: "Company Notes", type: "textarea", colSpan: 2 },

    { section: "Job", name: "job_title", label: "Job Title", required: true, colSpan: 2 },
    { section: "Job", name: "category_id", label: "Job Category", type: "select", options: opts.categories.map((c) => ({ value: c.id, label: c.name })) },
    { section: "Job", name: "subcategory", label: "Subcategory" },
    { section: "Job", name: "employment_type", label: "Employment Type", type: "select", options: EMPLOYMENT_TYPES },
    { section: "Job", name: "work_arrangement", label: "Work Arrangement", type: "select", options: WORK_ARRANGEMENTS },
    { section: "Job", name: "job_location", label: "Job Location" },
    { section: "Job", name: "experience", label: "Experience Required", placeholder: "e.g. 3-5 years" },
    { section: "Job", name: "salary_range", label: "Salary Range" },
    { section: "Job", name: "expected_ctc", label: "Expected CTC" },
    { section: "Job", name: "job_url", label: "Job Posting URL", colSpan: 2, placeholder: "https://" },
    { section: "Job", name: "job_description", label: "Complete Job Description", type: "textarea", colSpan: 2, rows: 6 },
    { section: "Job", name: "required_skills", label: "Required Skills", type: "textarea", colSpan: 2, rows: 2 },
    { section: "Job", name: "preferred_skills", label: "Preferred Skills", type: "textarea", colSpan: 2, rows: 2 },

    { section: "Application", name: "status", label: "Status", type: "select", options: APPLICATION_STATUSES },
    { section: "Application", name: "application_date", label: "Application Date", type: "date" },
    { section: "Application", name: "source", label: "Application Source", type: "select", options: APPLICATION_SOURCES },
    { section: "Application", name: "job_portal", label: "Job Portal" },
    { section: "Application", name: "recruiter_name", label: "Recruiter Name" },
    { section: "Application", name: "recruiter_email", label: "Recruiter Email", type: "email" },
    { section: "Application", name: "recruiter_phone", label: "Recruiter Phone" },
    { section: "Application", name: "recruiter_linkedin", label: "Recruiter LinkedIn" },

    { section: "Personal Details Used", name: "contact_pair", label: "Quick fill Email + Phone", type: "select", options: contactPairs, colSpan: 2, placeholder: "Pick a saved contact profile" },
    { section: "Personal Details Used", name: "email_used", label: "Email Used", type: "email" },
    { section: "Personal Details Used", name: "phone_used", label: "Mobile Used" },
    { section: "Personal Details Used", name: "resume_id", label: "Resume Version", type: "select", options: opts.resumes.map((r) => ({ value: r.id, label: `${r.name}${r.version ? " v" + r.version : ""}` })) },
    { section: "Personal Details Used", name: "cover_letter", label: "Cover Letter Used" },
    { section: "Personal Details Used", name: "additional_docs", label: "Additional Documents", colSpan: 2 },

    { section: "Additional", name: "reference_id", label: "Application Reference ID" },
    { section: "Additional", name: "follow_up_date", label: "Follow-up Date", type: "date" },
    { section: "Additional", name: "tags_text", label: "Custom Tags (comma separated)", colSpan: 2 },
    { section: "Additional", name: "important_instructions", label: "Important Instructions", type: "textarea", colSpan: 2 },
    { section: "Additional", name: "notes", label: "Notes", type: "textarea", colSpan: 2, rows: 3 },
  ];

  const defaults = { status: "Applied", application_date: new Date().toISOString().slice(0, 10) };
  const initialValues = initial
    ? { ...(initial.id ? {} : defaults), ...initial, tags_text: (initial.tags || []).join(", ") }
    : defaults;

  const handleSubmit = async (values) => {
    const payload = { ...values };
    // resolve contact pair
    if (payload.contact_pair) {
      const [em, ph] = payload.contact_pair.split("||");
      if (em && !payload.email_used) payload.email_used = em;
      if (ph && !payload.phone_used) payload.phone_used = ph;
    }
    delete payload.contact_pair;
    payload.tags = (payload.tags_text || "").split(",").map((t) => t.trim()).filter(Boolean);
    delete payload.tags_text;
    // attach resume_name snapshot
    if (payload.resume_id) {
      const r = opts.resumes.find((x) => x.id === payload.resume_id);
      if (r) payload.resume_name = `${r.name}${r.version ? " v" + r.version : ""}`;
    }
    try {
      if (initial?.id) {
        await api.put(`/applications/${initial.id}`, payload);
        toast.success("Application updated");
      } else {
        await api.post("/applications", payload);
        toast.success("Application added");
      }
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save");
      throw e;
    }
  };

  return (
    <FormDialog
      open={open} onOpenChange={onOpenChange}
      title={initial?.id ? "Edit Application" : "New Application"}
      description="Capture the full job and recruitment context so you never lose track."
      fields={fields} initial={initialValues} onSubmit={handleSubmit}
      submitLabel={initial?.id ? "Save Changes" : "Add Application"} testid="application"
    />
  );
}
