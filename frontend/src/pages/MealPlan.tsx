import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Coffee, Sun, Moon, Info, Sparkles, Utensils, Beaker, Lock, CheckCircle } from "lucide-react";
import { AIChatWidget } from "@/components/AIChatWidget";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

type MealDetail = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  ingredients: string[];
  instructions: string[];
};

const meals: { type: string; icon: React.ElementType; details: MealDetail }[] = [
  {
    type: "Breakfast",
    icon: Coffee,
    details: {
      name: "Oatmeal with Protein Powder & Mixed Berries",
      calories: "450 kcal", protein: "35g", carbs: "55g", fat: "8g",
      ingredients: ["1/2 cup rolled oats", "1 scoop vanilla whey", "1/2 cup mixed berries", "1 tbsp chia seeds", "1 cup almond milk"],
      instructions: ["Combine oats, chia seeds, and milk in a bowl.", "Microwave for 2 minutes or let sit overnight.", "Stir in whey protein until smooth.", "Top with mixed berries."]
    }
  },
  {
    type: "Lunch",
    icon: Sun,
    details: {
      name: "Grilled Chicken Salad with Quinoa",
      calories: "600 kcal", protein: "45g", carbs: "60g", fat: "20g",
      ingredients: ["6 oz chicken breast", "1/2 cup cooked quinoa", "2 cups mixed greens", "1/4 avocado", "1 tbsp olive oil dressing"],
      instructions: ["Season chicken and grill until internal temp reaches 165°F.", "Mix greens and quinoa in a large bowl.", "Slice cooked chicken and place on top.", "Slice avocado and add to salad.", "Drizzle with olive oil dressing."]
    }
  },
  {
    type: "Dinner",
    icon: Moon,
    details: {
      name: "Baked Salmon with Sweet Potato & Asparagus",
      calories: "550 kcal", protein: "40g", carbs: "45g", fat: "22g",
      ingredients: ["6 oz salmon fillet", "1 medium sweet potato", "1 cup asparagus", "1 tsp olive oil", "Lemon juice"],
      instructions: ["Preheat oven to 400°F.", "Dice sweet potato and roast for 25 mins.", "Season salmon and asparagus.", "Add salmon and asparagus to the baking sheet for the last 12-15 mins.", "Squeeze lemon juice over salmon before serving."]
    }
  },
];

export default function MealPlan() {
  const [mode, setMode] = useState<"ingredients" | "recipe">("ingredients");
  const [customFood, setCustomFood] = useState<Record<string, string>>({});
  const [selectedMeal, setSelectedMeal] = useState<MealDetail | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  const { user } = useAuth();
  const isPro = user?.isPro || false;
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [dailyPlans, setDailyPlans] = useState<any[]>([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);

  const formatLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatUTCDateKey = (date: Date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const fetchMealPlan = async () => {
    try {
      const [weekly, daily] = await Promise.all([
        api.get<any>('/api/v1/ai/weekly-meal-plan'),
        api.get<any[]>('/api/v1/ai/daily-meals')
      ]);
      if (weekly) setWeeklyData(weekly);
      if (daily) setDailyPlans(daily);
    } catch (err) {
      console.error("Failed to fetch meal plan", err);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleToggleEaten = async (mealId: string, currentStatus: boolean) => {
    try {
      await api.put(`/api/v1/ai/meals/${mealId}/eaten`, { eaten: !currentStatus });
      await fetchMealPlan();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message || "Could not update meal status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (user) {
      fetchMealPlan();
    }
  }, [user]);

  const handleGenerateMealPlan = async () => {
    if (!isPro) return;
    setIsGenerating(true);
    try {
      await api.post("/api/v1/ai/generate-weekly-meal-plan", {});
      toast({
        title: "Plan Generated",
        description: "Your personalized weekly meal plan has been created.",
      });
      // Automatically generate the shopping list to match
      await api.post("/api/v1/ai/generate-shopping-list", {});
      toast({
        title: "Shopping List Updated",
        description: "Your ingredient list has been synchronized.",
      });
      await fetchMealPlan();
    } catch (err: unknown) {
      toast({
        title: "Generation Failed",
        description: (err as Error).message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Derive meals to display based on selectedDayIndex
  const displayMeals = useMemo(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + selectedDayIndex);
    targetDate.setHours(0, 0, 0, 0);
    const targetKey = formatLocalDateKey(targetDate);

    const dayPlan = dailyPlans.find(dp => {
      const planDate = new Date(dp.date);
      return formatUTCDateKey(planDate) === targetKey;
    });

    if (!dayPlan || !dayPlan.meals || dayPlan.meals.length === 0) {
      return meals; // fallback to dummy data if no plan
    }

    // Sort meals if they have a scheduled hour, otherwise map straight
    return dayPlan.meals.map((m: any) => {
      let icon = Utensils;
      if (m.type === 'BREAKFAST') icon = Coffee;
      else if (m.type === 'LUNCH') icon = Sun;
      else if (m.type === 'DINNER') icon = Moon;
      else if (m.type === 'SNACK') icon = Info;

      let parsedIngredients = [];
      let parsedInstructions = [];
      try { parsedIngredients = typeof m.ingredients === 'string' ? JSON.parse(m.ingredients) : m.ingredients; } catch (e) { }
      try { parsedInstructions = typeof m.instructions === 'string' ? JSON.parse(m.instructions) : m.instructions; } catch (e) { }

      return {
        id: m.id,
        type: m.type,
        icon,
        eaten: m.eaten,
        details: {
          name: m.name,
          calories: `${m.calories} kcal`,
          protein: `${m.proteinG}g`,
          carbs: `${m.carbsG}g`,
          fat: `${m.fatG}g`,
          ingredients: parsedIngredients || [],
          instructions: parsedInstructions || []
        }
      };
    });
  }, [selectedDayIndex, dailyPlans]);

  const dates = useMemo(() => {
    return Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  // Determine if the current view should be blurred based on free plan limitations
  const isGated = !isPro && (selectedDayIndex > 0 || mode === "recipe");
  const isAIGated = !isPro;

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Utensils className="h-3.5 w-3.5" /> Nutrition Engine
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter">Meal Plan</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">Optimized fuel for your training regimen.</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            {isPro && (
              <Button onClick={handleGenerateMealPlan} disabled={isGenerating} className="shadow-glow hover:bg-primary/90 transition-all font-bold">
                <Sparkles className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : 'text-yellow-400'}`} />
                {isGenerating ? "Generating..." : "Generate AI Plan"}
              </Button>
            )}
            <div className="flex bg-secondary/30 p-1 rounded-xl border border-border/50 relative">
              <button
                onClick={() => setMode("ingredients")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "ingredients" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Beaker className="h-4 w-4" /> Single Foods
              </button>
              <button
                onClick={() => setMode("recipe")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "recipe" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Utensils className="h-4 w-4" /> Recipe & Prep Mode
              </button>
            </div>
          </div>
        </div>

        {/* 14-Day Date Carousel */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {dates.map((date, i) => {
            const isSelected = selectedDayIndex === i;
            return (
              <button
                key={i}
                onClick={() => setSelectedDayIndex(i)}
                className={`flex flex-col items-center justify-center min-w-[72px] h-20 rounded-xl border transition-all shrink-0 ${isSelected
                  ? "bg-primary/10 border-primary shadow-glow ring-1 ring-primary/50"
                  : "bg-secondary/30 border-border/50 hover:border-primary/30"
                  }`}
              >
                <span className={`text-xs uppercase font-bold tracking-wider mb-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                  {i === 0 ? "Today" : date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className={`text-xl font-display font-black ${isSelected ? "text-foreground" : "text-foreground/80"}`}>
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area with Blur Overlay */}
        {!weeklyData && !isLoadingPlan ? (
          <div className="glass-card p-12 text-center mt-8 border-dashed border-2 border-border/50 bg-secondary/5 flex flex-col items-center justify-center min-h-[400px]">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Utensils className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-3xl font-display font-bold mb-4">No Plan Active</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Your nutrition engine is standing by. Generate a personalized weekly meal plan based on your exact biometric targets and preferences.
            </p>
            {isPro ? (
              <Button onClick={handleGenerateMealPlan} disabled={isGenerating} size="lg" className="shadow-glow h-14 px-8 text-lg font-bold">
                <Sparkles className={`h-5 w-5 mr-2 ${isGenerating ? 'animate-spin' : 'text-yellow-400'}`} />
                {isGenerating ? "Generating..." : "Generate AI Plan"}
              </Button>
            ) : (
              <Link to="/billing">
                <Button size="lg" className="shadow-glow h-14 px-8 text-lg font-bold">
                  Upgrade to Pro <Lock className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className={`grid md:grid-cols-3 gap-8 transition-all duration-300 ${isGated ? "blur-md pointer-events-none opacity-50" : ""}`}>
              <div className="md:col-span-2 space-y-6">
                {displayMeals.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <div key={i} className="glass-card overflow-hidden hover:border-primary/50 transition-colors group">
                      <div className="p-4 bg-secondary/20 flex items-center justify-between border-b border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center border border-border/50 group-hover:border-primary/50 transition-colors">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="font-display font-bold uppercase tracking-widest text-sm">{m.type}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.id && (
                            <Button
                              variant={m.eaten ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleEaten(m.id, m.eaten)}
                              className={`gap-2 ${m.eaten ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' : ''}`}
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {m.eaten ? 'Eaten' : 'Mark Eaten'}
                            </Button>
                          )}
                          {mode === "recipe" && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedMeal(m.details)} className="gap-2">
                              <Info className="h-3.5 w-3.5" /> View Method
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className={`p-6 transition-all ${m.eaten ? 'opacity-50' : ''}`}>
                        <h4 className="font-display text-2xl font-bold mb-4">{m.details.name}</h4>
                        <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
                          <span className="bg-primary/10 text-primary font-mono px-3 py-1 rounded border border-primary/20">{m.details.calories}</span>
                          <span className="text-muted-foreground font-mono">P: <strong className="text-foreground">{m.details.protein}</strong></span>
                          <span className="text-muted-foreground font-mono">C: <strong className="text-foreground">{m.details.carbs}</strong></span>
                          <span className="text-muted-foreground font-mono">F: <strong className="text-foreground">{m.details.fat}</strong></span>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-3">Core Constituents</p>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {m.details.ingredients.map((ing, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5"></span>
                                {ing}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-6 relative">
                <div className={`glass-card p-6 border-l-2 border-l-primary relative overflow-hidden sticky top-6 transition-all duration-300 ${isAIGated ? "blur-md pointer-events-none opacity-50" : ""}`}>
                  <Sparkles className="absolute -bottom-4 -right-4 h-32 w-32 text-primary/10 pointer-events-none" />
                  <h3 className="font-display font-bold text-xl mb-4 relative z-10 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> AI Meal Assistant
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 relative z-10">
                    Request substitution mapping, exact macro adjustments, or flavor profile shifts.
                  </p>
                  <div className="relative z-10">
                    <AIChatWidget
                      context="meal"
                      onPlanUpdated={() => { void fetchMealPlan(); }}
                      suggestions={[
                        "Make breakfast vegan",
                        "I don't have asparagus",
                        "Boost protein by 20g"
                      ]}
                    />
                  </div>
                </div>

                {/* Freemium Overlay Paywall for AI Assistant */}
                {isAIGated && (
                  <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center p-4 text-center">
                    <div className="glass-card w-full p-6 shadow-2xl border-primary/30 flex flex-col items-center bg-background/95 backdrop-blur-xl">
                      <div className="h-12 w-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4 ring-8 ring-primary/5">
                        <Lock className="h-6 w-6" />
                      </div>
                      <h3 className="font-display font-bold text-lg mb-2">Pro Access Required</h3>
                      <p className="text-muted-foreground mb-6 text-xs leading-relaxed">
                        The AI Meal Assistant is reserved for Pro operators.
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

            {/* Freemium Overlay Paywall */}
            {isGated && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-background/5 rounded-2xl">
                <div className="glass-card max-w-sm w-full p-8 shadow-2xl border-primary/30 flex flex-col items-center">
                  <div className="h-16 w-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                    <Lock className="h-8 w-8" />
                  </div>
                  <h3 className="font-display font-bold text-2xl mb-2">Pro Access Required</h3>
                  <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                    Recipe Mode and future day planning are highly complex calculations reserved for Pro operators. Unlock the full plan to optimize your physique.
                  </p>
                  <Link to="/billing" className="w-full">
                    <Button className="w-full font-bold shadow-glow text-md h-12">
                      Upgrade to Pro <Sparkles className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                  <button
                    onClick={() => {
                      setMode("ingredients");
                      setSelectedDayIndex(0);
                    }}
                    className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Return to Today's Single Foods
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recipe Modal */}
        <Dialog open={!!selectedMeal && !isGated} onOpenChange={() => setSelectedMeal(null)}>
          <DialogContent className="sm:max-w-xl bg-card border-border">
            {selectedMeal && (
              <>
                <DialogHeader>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2 w-max">
                    Preparation Protocol
                  </div>
                  <DialogTitle className="font-display text-2xl leading-tight pb-2 border-b border-border/50">
                    {selectedMeal.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-6">
                  <div>
                    <h4 className="font-display font-bold text-lg mb-3">Ingredients</h4>
                    <ul className="space-y-1.5">
                      {selectedMeal.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
                          <span className="text-muted-foreground">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-display font-bold text-lg mb-3">Method</h4>
                    <ol className="space-y-4 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border/50">
                      {selectedMeal.instructions.map((step, i) => (
                        <li key={i} className="relative flex gap-4 text-sm">
                          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex flex-center items-center justify-center font-bold text-xs ring-4 ring-card shrink-0 z-10">
                            {i + 1}
                          </div>
                          <p className="pt-0.5 text-foreground/90 leading-relaxed">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button variant="outline" onClick={() => setSelectedMeal(null)}>Close Protocol</Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
