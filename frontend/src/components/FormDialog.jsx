import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

// Schema-driven form. fields: [{name,label,type,options,section,placeholder,required,colSpan}]
export function FormDialog({ open, onOpenChange, title, description, fields, initial = {}, onSubmit, submitLabel = "Save", testid = "form" }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      const base = {};
      fields.forEach((f) => { base[f.name] = initial[f.name] ?? (f.type === "multiselect" ? [] : ""); });
      setValues(base);
      setErrors({});
    }
  }, [open]); // eslint-disable-line

  const set = (name, v) => setValues((p) => ({ ...p, [name]: v }));

  const submit = async () => {
    const errs = {};
    fields.forEach((f) => { if (f.required && !values[f.name]) errs[f.name] = `${f.label} is required`; });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const sections = [...new Set(fields.map((f) => f.section || "Details"))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-card max-h-[90vh] flex flex-col" data-testid={`${testid}-dialog`}>
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="font-display">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-6">
            {sections.map((sec) => (
              <div key={sec}>
                {sections.length > 1 && <h4 className="font-display text-sm font-semibold text-primary mb-3">{sec}</h4>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {fields.filter((f) => (f.section || "Details") === sec).map((f) => (
                    <div key={f.name} className={f.colSpan === 2 ? "sm:col-span-2" : ""}>
                      <Label className="text-xs font-medium mb-1.5 block">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                      {f.type === "textarea" ? (
                        <Textarea data-testid={`${testid}-field-${f.name}`} value={values[f.name] || ""} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} rows={f.rows || 3} />
                      ) : f.type === "select" ? (
                        <Select value={values[f.name] || ""} onValueChange={(v) => set(f.name, v)}>
                          <SelectTrigger data-testid={`${testid}-field-${f.name}`}><SelectValue placeholder={f.placeholder || "Select"} /></SelectTrigger>
                          <SelectContent className="bg-popover">
                            {(f.options || []).map((o) => (
                              <SelectItem key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>
                                {typeof o === "string" ? o : o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input data-testid={`${testid}-field-${f.name}`} type={f.type || "text"} value={values[f.name] || ""} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
                      )}
                      {errors[f.name] && <p className="text-xs text-destructive mt-1">{errors[f.name]}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid={`${testid}-cancel`}>Cancel</Button>
          <Button onClick={submit} disabled={saving} data-testid={`${testid}-submit`}>{saving ? "Saving..." : submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
