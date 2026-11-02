import React from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { TrendingUp, Moon, Sun, BarChart3, CalendarCheck, FileText, Target } from "lucide-react";

export default function Login() {
  const { theme, toggleTheme } = useTheme();

  const signIn = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left - brand/visual */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-[hsl(243_60%_12%)] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(243 85% 60%) 0, transparent 40%), radial-gradient(circle at 80% 70%, hsl(217 90% 55%) 0, transparent 40%)" }} />
        <div className="relative flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary grid place-items-center"><TrendingUp className="h-6 w-6 text-white" /></div>
          <span className="font-display text-xl font-bold">CareerTrack BI</span>
        </div>
        <div className="relative space-y-6">
          <h1 className="font-display text-4xl font-bold leading-tight">Your Career.<br />Your Applications.<br />Your Intelligence.</h1>
          <p className="text-white/70 max-w-md">A private recruitment intelligence workspace — track every application, assessment and interview with analytics that actually help you decide what to do next.</p>
          <div className="grid grid-cols-2 gap-4 max-w-md pt-4">
            {[[BarChart3, "Live BI dashboard"], [Target, "Recruitment funnel"], [CalendarCheck, "Interview calendar"], [FileText, "Resume library"]].map(([Icon, label], i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                <Icon className="h-4 w-4 text-primary" /> {label}
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/40">Private workspace · Secure Google sign-in</div>
      </div>

      {/* Right - sign in */}
      <div className="flex flex-col items-center justify-center p-8 relative">
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="absolute top-6 right-6" data-testid="theme-toggle">
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <div className="h-10 w-10 rounded-xl bg-primary grid place-items-center"><TrendingUp className="h-6 w-6 text-white" /></div>
            <span className="font-display text-xl font-bold">CareerTrack BI</span>
          </div>
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-2">Sign in to access your recruitment dashboard</p>
          </div>
          <Button onClick={signIn} className="w-full h-12 text-base gap-3" data-testid="google-signin-btn">
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" opacity=".9"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" opacity=".7"/><path fill="currentColor" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" opacity=".5"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" opacity=".8"/></svg>
            Continue with Google
          </Button>
          <p className="text-xs text-center text-muted-foreground">This is a private workspace. Access is restricted to the owner account.</p>
        </div>
      </div>
    </div>
  );
}
