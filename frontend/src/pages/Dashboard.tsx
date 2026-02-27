import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { Flame, Droplets, Target, TrendingUp, Utensils, Dumbbell, ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { AIChatWidget } from "@/components/AIChatWidget";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const macros = [
  { label: "Calories", value: 2150, target: 2400, icon: Flame, color: "text-orange-400" },
  { label: "Protein", value: 142, target: 180, unit: "g", icon: Logo, color: "text-primary" },
  { label: "Carbs", value: 220, target: 280, unit: "g", icon: Droplets, color: "text-blue-400" },
  { label: "Fat", value: 68, target: 80, unit: "g", icon: Target, color: "text-yellow-400" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const isPro = user?.isPro || false;

  const [profileData, setProfileData] = useState<any>(null);
  const [todayPlan, setTodayPlan] = useState<any>(null);

  useEffect(() => {
    if (user) {
      // api.get already unwraps json.data – so the result IS the inner data object
      api.get<any>("/api/v1/profile")
        .then((data) => {
          if (data?.profile) setProfileData(data.profile);
        })
        .catch(console.error);

      api.get<any>("/api/v1/ai/today")
        .then((data) => {
          if (data) setTodayPlan(data);
        })
        .catch(console.error);
    }
  }, [user]);

  // Targets come from profile, consumed comes from today's DailyMealPlan
  const targetCalories = profileData?.dailyCalories || 2400;
  const targetProtein = profileData?.macroTargets?.proteinG || 180;
  const targetCarbs = profileData?.macroTargets?.carbsG || 280;
  const targetFat = profileData?.macroTargets?.fatG || 80;

  const consumedCalories = todayPlan?.meals?.filter((m: any) => m.eaten).reduce((sum: number, m: any) => sum + m.calories, 0) || 0;
  const consumedProtein = todayPlan?.meals?.filter((m: any) => m.eaten).reduce((sum: number, m: any) => sum + m.proteinG, 0) || 0;
  const consumedCarbs = todayPlan?.meals?.filter((m: any) => m.eaten).reduce((sum: number, m: any) => sum + m.carbsG, 0) || 0;
  const consumedFat = todayPlan?.meals?.filter((m: any) => m.eaten).reduce((sum: number, m: any) => sum + m.fatG, 0) || 0;
  const completedExercises = todayPlan?.exercises?.filter((e: any) => e.completed).length || 0;
  const totalExercises = todayPlan?.exercises?.length || 0;

  const displayMacros = [
    { label: "Calories", value: consumedCalories, target: targetCalories, icon: Flame, color: "text-orange-400" },
    { label: "Protein", value: Math.round(consumedProtein), target: targetProtein, unit: "g", icon: Logo, color: "text-primary" },
    { label: "Carbs", value: Math.round(consumedCarbs), target: targetCarbs, unit: "g", icon: Droplets, color: "text-blue-400" },
    { label: "Fat", value: Math.round(consumedFat), target: targetFat, unit: "g", icon: Target, color: "text-yellow-400" },
  ];

  const todayMealCount = todayPlan?.meals?.length || 0;
  const quickActions = [
    { title: "Today's Meals", desc: `${todayMealCount} planned`, icon: Utensils, url: "/meal-plan" },
    { title: "Today's Workout", desc: `${completedExercises}/${totalExercises} completed`, icon: Dumbbell, url: "/workout-plan" },
  ];

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Good morning 👋</h1>
          <p className="text-muted-foreground mt-1">Here's your daily snapshot.</p>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {displayMacros.map((m) => {
            const pct = Math.round((m.value / m.target) * 100);
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                </div>
                <p className="text-2xl font-display font-bold">
                  {m.value}
                  {m.unit && <span className="text-sm text-muted-foreground ml-1">{m.unit}</span>}
                </p>
                <Progress value={pct} className="mt-3 h-1.5" />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {pct}% of {m.target}
                  {m.unit || " kcal"}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          {quickActions.map((a) => (
            <Link key={a.title} to={a.url}>
              <div className="glass-card p-6 flex items-center justify-between hover:border-primary/30 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <a.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Weekly Trend */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">Weekly Progress</h2>
            </div>
            <div className="flex items-end gap-3 h-32 mt-8">
              {[65, 80, 55, 90, 70, 85, 60].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-primary/20 hover:bg-primary/40 transition-colors"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Dashboard Section */}
          <div className="relative">
            <div className={`glass-card p-6 border-l-2 border-l-primary relative overflow-hidden transition-all duration-300 ${!isPro ? "blur-md pointer-events-none opacity-50" : ""}`}>
              <Sparkles className="absolute -bottom-4 -right-4 h-32 w-32 text-primary/10 pointer-events-none" />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold text-lg">AI Dashboard</h2>
              </div>

              <div className="mb-6 relative z-10 bg-primary/5 border border-primary/20 p-4 rounded-lg">
                <p className="text-sm text-foreground/90 leading-relaxed italic">
                  "Your weekly compliance is trending up at 85%. You're hitting protein targets perfectly, but watch out for slight carbohydrate overages on rest days. Keep up the solid momentum!"
                </p>
              </div>

              <div className="relative z-10">
                <AIChatWidget
                  context="dashboard"
                  onPlanUpdated={() => {
                    api.get<any>("/api/v1/ai/today").then((data) => setTodayPlan(data)).catch(() => {});
                  }}
                  suggestions={[
                    "Analyze my weekly trend",
                    "How can I improve my macros today?",
                    "Summarize my biometric data"
                  ]}
                />
              </div>
            </div>

            {/* Freemium Overlay Paywall */}
            {!isPro && (
              <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center p-6 text-center">
                <div className="glass-card w-full p-6 shadow-2xl border-primary/30 flex flex-col items-center bg-background/95 backdrop-blur-xl">
                  <div className="h-12 w-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h3 className="font-display font-bold text-lg mb-2">Pro Access Required</h3>
                  <p className="text-muted-foreground mb-6 text-xs leading-relaxed">
                    AI Dashboard analytics are reserved for Pro operators.
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
        </div>
      </div>
    </AppLayout>
  );
}
