import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Activity, Plus, TrendingDown, TrendingUp, HeartPulse, TabletSmartphone, Sparkles, Scale, Maximize, ActivitySquare, Lock } from "lucide-react";
import { AIChatWidget } from "@/components/AIChatWidget";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

const history = [
  { date: "2026-02-21", weight: 78.2, fat: 18.5, waist: 84, chest: 102 },
  { date: "2026-02-14", weight: 78.8, fat: 18.8, waist: 85, chest: 101 },
  { date: "2026-02-07", weight: 79.5, fat: 19.1, waist: 86, chest: 101 },
  { date: "2026-01-31", weight: 80.1, fat: 19.4, waist: 87, chest: 100 },
];

export default function BiometricTracker() {
  const [showAI, setShowAI] = useState(false);

  const { user } = useAuth();
  const isPro = user?.isPro || false;

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0 max-w-5xl mx-auto">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Activity className="h-3.5 w-3.5" /> Performance Metrics
            </div>
            <h1 className="text-4xl font-display font-black tracking-tighter">Biometric Data</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">Continuous tracking integrated with your OS health data.</p>
          </div>

          <div className="flex flex-col gap-3 relative">
            <div className={`flex flex-col gap-3 transition-all duration-300 ${!isPro ? "blur-sm pointer-events-none opacity-50" : ""}`}>
              <Button variant="outline" className="gap-2 h-12 rounded-xl text-sm" onClick={() => alert("Connecting to Apple Health (Simulation)")}>
                <HeartPulse className="h-4 w-4" /> Sync Apple Health
              </Button>
              <Button variant="outline" className="gap-2 h-12 rounded-xl text-sm" onClick={() => alert("Connecting to Google Fit (Simulation)")}>
                <TabletSmartphone className="h-4 w-4" /> Sync Android Health
              </Button>
            </div>

            {!isPro && (
              <div className="absolute inset-0 z-10 flex items-center justify-center p-2 text-center">
                <div className="bg-background/90 backdrop-blur-md px-4 py-3 rounded-xl border border-primary/20 shadow-xl flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">Pro Sync</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Health Agent Highlight */}
        <div className="relative">
          <div className={`glass-card p-1 border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden relative transition-all duration-300 ${!isPro ? "blur-md pointer-events-none opacity-50" : ""}`}>
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sparkles className="h-32 w-32 text-primary" />
            </div>
            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1 space-y-4">
                <h2 className="text-2xl font-display font-bold flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-primary" /> OS Health Insights
                </h2>
                <p className="text-muted-foreground">
                  I've analyzed your recent iOS/Android data drops. You are losing fat steadily (-0.9% this month), but your resting heart rate elevated slightly last week. This indicates you might be overtraining.
                </p>
                <Button onClick={() => setShowAI(!showAI)} className="mt-2">
                  {showAI ? "Hide Analysis" : "Chat with Health Agent"}
                </Button>
              </div>

              {showAI && (
                <div className="flex-1 w-full animate-in slide-in-from-right-8 duration-500">
                  <AIChatWidget
                    context="biometrics"
                    suggestions={["How do I fix my resting heart rate?", "Analyze my sleep vs weight trend", "Should I eat more carbs?"]}
                  />
                </div>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center p-4 text-center">
              <div className="glass-card w-full max-w-sm p-6 shadow-2xl border-primary/30 flex flex-col items-center bg-background/95 backdrop-blur-xl">
                <div className="h-12 w-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">Pro Access Required</h3>
                <p className="text-muted-foreground mb-6 text-xs leading-relaxed">
                  OS Health Insights and AI Analysis are reserved for Pro operators.
                </p>
                <Link to="/billing" className="w-full">
                  <Button className="w-full font-bold shadow-glow text-sm h-10">
                    Upgrade <Sparkles className="h-3 w-3 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Highlight Stats Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-6 flex flex-col justify-between h-32">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Weight</span>
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <p className="text-3xl font-display font-bold">78.2 <span className="text-base text-muted-foreground font-sans font-normal">kg</span></p>
              <p className="text-xs text-primary mt-1 font-medium flex items-center gap-1"><TrendingDown className="h-3 w-3" /> -0.6 kg vs week</p>
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col justify-between h-32">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Body Fat</span>
              <ActivitySquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-3xl font-display font-bold">18.5 <span className="text-base text-muted-foreground font-sans font-normal">%</span></p>
              <p className="text-xs text-primary mt-1 font-medium flex items-center gap-1"><TrendingDown className="h-3 w-3" /> -0.3% vs week</p>
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col justify-between h-32">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Chest</span>
              <Maximize className="h-4 w-4" />
            </div>
            <div>
              <p className="text-3xl font-display font-bold">102 <span className="text-base text-muted-foreground font-sans font-normal">cm</span></p>
              <p className="text-xs text-primary mt-1 font-medium flex items-center gap-1"><TrendingUp className="h-3 w-3" /> +1 cm vs week</p>
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col flex-center justify-center h-32 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer border-dashed border-2 border-border/50">
            <div className="text-center">
              <Plus className="h-6 w-6 text-primary mx-auto mb-2" />
              <span className="text-sm font-medium text-foreground">Manual Log</span>
            </div>
          </div>
        </div>

        {/* History Log */}
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/50 bg-secondary/10 flex justify-between items-center">
            <h3 className="font-display font-bold uppercase tracking-wider text-sm text-muted-foreground">Raw Data Log</h3>
          </div>
          <div className="divide-y divide-border/30">
            {history.map((entry, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors text-sm">
                <span className="font-mono text-muted-foreground w-28">{entry.date}</span>
                <span className="w-20 text-right"><strong className="text-foreground">{entry.weight}</strong> kg</span>
                <span className="w-20 text-right"><strong className="text-foreground">{entry.fat}</strong>%</span>
                <span className="w-24 text-right hidden sm:block"><strong className="text-foreground">{entry.waist}</strong> cm (W)</span>
                <span className="w-24 text-right hidden sm:block"><strong className="text-foreground">{entry.chest}</strong> cm (C)</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
