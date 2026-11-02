import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageStates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Upload, Moon, Sun } from "lucide-react";

const download = async (path, filename) => {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const EXPORTS = [
  { path: "/export/applications.csv", file: "applications.csv", label: "Applications CSV", id: "export-applications-csv" },
  { path: "/export/assessments.csv", file: "assessments.csv", label: "Assessments CSV", id: "export-assessments-csv" },
  { path: "/export/interviews.csv", file: "interviews.csv", label: "Interviews CSV", id: "export-interviews-csv" },
  { path: "/export/backup", file: "careertrack-backup.json", label: "Full JSON backup", id: "export-backup-json" },
];

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [currency, setCurrency] = useState("INR");
  const [mode, setMode] = useState("merge");
  const fileRef = useRef(null);

  useEffect(() => { api.get("/preferences").then(({ data }) => setCurrency(data.currency || "INR")).catch(() => {}); }, []);

  const savePref = async (patch) => {
    try { await api.put("/preferences", patch); toast.success("Preferences saved"); }
    catch { toast.error("Could not save preferences"); }
  };

  const changeTheme = (t) => { setTheme(t); savePref({ theme: t }); };
  const changeCurrency = (c) => { setCurrency(c); savePref({ currency: c }); };

  const onExport = async (e) => {
    try { await download(e.path, e.file); toast.success(`${e.label} downloaded`); }
    catch { toast.error("Export failed"); }
  };

  const onRestore = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (!json.collections) throw new Error("Invalid backup file");
      const { data } = await api.post("/restore", { collections: json.collections, mode });
      const total = Object.values(data.inserted).reduce((a, b) => a + b, 0);
      toast.success(`Restore complete — ${total} records imported`);
    } catch (err) {
      toast.error(err.message || "Restore failed");
    }
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" subtitle="Preferences, exports and backups." />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-base font-display">Account</CardTitle></CardHeader>
          <CardContent className="text-sm" data-testid="settings-account">
            <div className="font-medium">{user?.name}</div>
            <div className="text-muted-foreground">{user?.email}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-display">Preferences</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex gap-2">
                <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => changeTheme("dark")} data-testid="theme-dark-btn"><Moon className="h-4 w-4 mr-2" />Dark</Button>
                <Button variant={theme === "light" ? "default" : "outline"} onClick={() => changeTheme("light")} data-testid="theme-light-btn"><Sun className="h-4 w-4 mr-2" />Light</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default salary currency</Label>
              <Select value={currency} onValueChange={changeCurrency}>
                <SelectTrigger data-testid="currency-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">₹ INR</SelectItem>
                  <SelectItem value="USD">$ USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Export data</CardTitle>
            <CardDescription>Download your records as CSV or a complete JSON backup.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {EXPORTS.map((e) => (
              <Button key={e.id} variant="outline" className="justify-start" onClick={() => onExport(e)} data-testid={e.id}>
                <Download className="h-4 w-4 mr-2" />{e.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Restore from backup</CardTitle>
            <CardDescription>Merge keeps existing records; replace wipes them before importing.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="sm:w-48" data-testid="restore-mode-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">Merge</SelectItem>
                <SelectItem value="replace">Replace</SelectItem>
              </SelectContent>
            </Select>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onRestore} data-testid="restore-file-input" />
            <Button onClick={() => fileRef.current?.click()} data-testid="restore-upload-btn"><Upload className="h-4 w-4 mr-2" />Upload backup JSON</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
