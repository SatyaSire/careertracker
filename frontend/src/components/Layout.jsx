import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import {
  TrendingUp, LayoutDashboard, Briefcase, Tags, ClipboardCheck, CalendarDays, FileText,
  Users, Building2, BarChart3, Bell, History, Settings, Menu, Moon, Sun, LogOut,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/applications", label: "All Applications", icon: Briefcase },
  { to: "/categories", label: "Job Categories", icon: Tags },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/interviews", label: "Interviews & Calendar", icon: CalendarDays },
  { to: "/resumes", label: "Resume Library", icon: FileText },
  { to: "/contacts", label: "Accounts & Contacts", icon: Users },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/analytics", label: "BI Analytics", icon: BarChart3 },
  { to: "/reminders", label: "Reminders", icon: Bell },
  { to: "/activity", label: "Activity History", icon: History },
  { to: "/settings", label: "Settings & Backup", icon: Settings },
];

const SidebarContent = ({ onNav }) => (
  <div className="flex h-full flex-col">
    <div className="flex items-center gap-2 px-5 h-16 border-b shrink-0">
      <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center"><TrendingUp className="h-5 w-5 text-primary-foreground" /></div>
      <div className="leading-none">
        <div className="font-display font-bold text-sm">CareerTrack BI</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Recruitment Intelligence</div>
      </div>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 ct-scroll-hint">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNav}
          data-testid={`nav-${to.slice(1)}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </nav>
  </div>
);

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r bg-card z-30">
        <SidebarContent />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 border-b bg-card/95 backdrop-blur flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-btn"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-card">
                <SidebarContent onNav={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary grid place-items-center"><TrendingUp className="h-4 w-4 text-primary-foreground" /></div>
              <span className="font-display font-bold text-sm">CareerTrack BI</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-1.5 pr-2.5" data-testid="user-menu-btn">
                  <Avatar className="h-7 w-7"><AvatarImage src={user?.picture} /><AvatarFallback>{(user?.name || "U")[0]}</AvatarFallback></Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover">
                <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="menu-settings"><Settings className="h-4 w-4 mr-2" />Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={logout} data-testid="menu-logout" className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
