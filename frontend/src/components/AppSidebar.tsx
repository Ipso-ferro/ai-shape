import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Utensils,
  Dumbbell,
  ShoppingCart,
  User,
  CreditCard,
  Activity,
  Menu,
  X,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meal Plan", url: "/meal-plan", icon: Utensils },
  { title: "Workout Plan", url: "/workout-plan", icon: Dumbbell },
  { title: "Shopping List", url: "/shopping-list", icon: ShoppingCart },
  { title: "Biometrics", url: "/biometrics", icon: Activity },
  { title: "Friend Sync", url: "/friend-sync", icon: Users },
  { title: "Profile & Targets", url: "/profile", icon: User },
  { title: "Billing", url: "/billing", icon: CreditCard },
];

export function AppSidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-card border border-border"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"
          } md:sticky md:top-0 md:h-screen`}
      >
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center p-1.5 overflow-hidden">
              <Logo className="h-full w-full text-primary-foreground group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg leading-tight tracking-tight">ai-shape</span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Pro Operator</span>
            </div>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.url;
            return (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                  ? "bg-primary/10 text-primary glow-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 mx-3 mb-4 rounded-lg bg-secondary/50 border border-border/50">
          <p className="text-xs text-muted-foreground">Free Plan</p>
          <Link to="/billing" onClick={() => setMobileOpen(false)} className="text-xs text-primary font-medium mt-1 hover:underline block cursor-pointer">
            Upgrade to Pro →
          </Link>
        </div>
      </aside>
    </>
  );
}
