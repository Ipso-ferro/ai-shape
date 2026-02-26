import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { User, Bell, Shield, LogOut, Check, ArrowRight, Upload, SwitchCamera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  email: string;
  isPro: boolean;
  subscriptionTier: string;
  profile: {
    gender: string;
    ageYrs: number;
    heightCm: number;
    weightKg: number;
    targetWeightKg: number;
    goals: string[];
    workoutLocations: string[];
    diets: string[];
    allergies: string[];
    activityLevel: string;
    macroVelocity: string;
    macroTargets: { proteinG: number; carbsG: number; fatG: number };
  } | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const ALLERGY_OPTIONS = ["Gluten", "Dairy", "Nuts", "Shellfish", "Soy", "Eggs", "Fish", "Wheat"];
const LOCATION_LABELS: Record<string, string> = {
  GYM: "Gym Facility",
  HOME: "Home Setup",
  CALISTHENICS: "Calisthenics (No Eq.)",
};
const LOCATION_VALUES = Object.keys(LOCATION_LABELS);
const GOAL_OPTIONS = ["Lose Weight", "Build Muscle", "Maintain", "Improve Health", "Athletic Performance"];

const VELOCITY_VALUES: Record<string, string> = {
  SLOW: "slow",
  AI_RECOMMENDED: "ai-recommended",
  FAST: "fast",
};
const VELOCITY_TO_ENUM: Record<string, string> = {
  slow: "SLOW",
  "ai-recommended": "AI_RECOMMENDED",
  fast: "FAST",
};
const DIET_TO_SELECT: Record<string, string> = {
  "No Preference": "omnivore",
  Vegetarian: "vegetarian",
  Vegan: "vegan",
  Keto: "keto",
  Paleo: "paleo",
  Mediterranean: "mediterranean",
};
const SELECT_TO_DIET: Record<string, string> = Object.fromEntries(
  Object.entries(DIET_TO_SELECT).map(([k, v]) => [v, k])
);

// ─── Component ─────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();

  // ─── Remote state ────────────────────────────────────────────────────────────
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ─── Local editable state ────────────────────────────────────────────────────
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [selectedDiet, setSelectedDiet] = useState("omnivore");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [velocity, setVelocity] = useState("ai-recommended");
  const [activityLevel, setActivityLevel] = useState("MODERATELY_ACTIVE");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");

  // ─── Fetch Profile ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.get<ProfileData>("/api/v1/profile")
      .then((data) => {
        setProfileData(data);
        const p = data.profile;
        if (!p) return;

        // Map diet array to select value (pick first known match)
        const dietLabel = p.diets.find((d) => DIET_TO_SELECT[d]) ?? "No Preference";
        setSelectedDiet(DIET_TO_SELECT[dietLabel] ?? "omnivore");

        // Allergies — filter to known options (exclude "None")
        setSelectedAllergies(p.allergies.filter((a) => a !== "None" && ALLERGY_OPTIONS.includes(a)));

        // Workout locations (DB stores e.g. "GYM", display "Gym Facility")
        setSelectedLocations(p.workoutLocations.filter((l) => LOCATION_VALUES.includes(l)));

        // Goals
        setSelectedGoals(p.goals.filter((g) => GOAL_OPTIONS.includes(g)));

        // Velocity
        setVelocity(VELOCITY_VALUES[p.macroVelocity] ?? "ai-recommended");

        // Activity level
        setActivityLevel(p.activityLevel ?? "MODERATELY_ACTIVE");

        // Macros
        setProteinG(String(p.macroTargets.proteinG));
        setCarbsG(String(p.macroTargets.carbsG));
        setFatG(String(p.macroTargets.fatG));
      })
      .catch(() => {
        toast({ title: "Failed to load profile", variant: "destructive" });
      })
      .finally(() => setIsLoading(false));
  }, []);

  // ─── Save Changes ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const diets = [SELECT_TO_DIET[selectedDiet] ?? "No Preference"];
      const allergies = selectedAllergies.length > 0 ? selectedAllergies : ["None"];

      await api.patch("/api/v1/profile", {
        diets,
        allergies,
        workoutLocations: selectedLocations,
        goals: selectedGoals,
        macroVelocity: VELOCITY_TO_ENUM[velocity] ?? "AI_RECOMMENDED",
        activityLevel,
        proteinG: parseInt(proteinG) || undefined,
        carbsG: parseInt(carbsG) || undefined,
        fatG: parseInt(fatG) || undefined,
      });

      toast({ title: "Profile synced ✓", description: "Your parameters have been updated." });
    } catch (err: unknown) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const toggleItem = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const p = profileData?.profile;

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0 max-w-4xl mx-auto">
        <div className="flex items-center justify-between pb-6 border-b border-border/50">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter">Command Center</h1>
            <p className="text-muted-foreground mt-2">Manage your operator profile, protocols, and directives.</p>
          </div>
          {profileData?.isPro && (
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-primary/30">
              Pro
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* ── Identity & Contact ─────────────────────────────────────────── */}
          <div className="md:col-span-2 space-y-8">
            <div className="glass-card p-6">
              <h2 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Operator Identity
              </h2>

              <div className="flex flex-col sm:flex-row gap-8 items-start mb-8 pb-8 border-b border-border/50">
                <div className="relative group mx-auto sm:mx-0">
                  <div className="h-32 w-32 rounded-xl bg-secondary/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                    <User className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                  <button className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl gap-2 font-bold text-sm">
                    <Upload className="h-5 w-5 text-primary" /> Upload Avatar
                  </button>
                </div>

                <div className="flex-1 space-y-4 w-full">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</Label>
                    <Input
                      value={profileData?.email ?? ""}
                      readOnly
                      className="bg-background/50 h-10 font-mono opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gender</Label>
                      <Input value={p?.gender ?? "—"} readOnly className="bg-background/50 h-10 font-mono opacity-70 cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Age</Label>
                      <Input value={p?.ageYrs ?? "—"} readOnly className="bg-background/50 h-10 font-mono opacity-70 cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Height (cm)</Label>
                      <Input value={p?.heightCm ?? "—"} readOnly className="bg-background/50 h-10 font-mono opacity-70 cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weight (kg)</Label>
                      <Input value={p?.weightKg ?? "—"} readOnly className="bg-background/50 h-10 font-mono opacity-70 cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Bio-Parameters (editable) ─────────────────────────────── */}
              <h2 className="font-display font-bold text-xl mb-6 mt-8 flex items-center gap-2">
                <SwitchCamera className="h-5 w-5 text-primary" /> Bio-Parameters Setting
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* Diet */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nutritional Alignment</Label>
                    <Select value={selectedDiet} onValueChange={setSelectedDiet}>
                      <SelectTrigger className="w-full bg-background/50">
                        <SelectValue placeholder="Select Diet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="omnivore">Standard Omnivore</SelectItem>
                        <SelectItem value="vegetarian">Vegetarian</SelectItem>
                        <SelectItem value="vegan">Vegan Protocol</SelectItem>
                        <SelectItem value="keto">Ketogenic Frame</SelectItem>
                        <SelectItem value="paleo">Paleo</SelectItem>
                        <SelectItem value="mediterranean">Mediterranean</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Allergies */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Food Allergies / Exclusions</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {ALLERGY_OPTIONS.map((allergy) => (
                        <div key={allergy} className="flex items-center space-x-2">
                          <Checkbox
                            id={`allergy-${allergy}`}
                            checked={selectedAllergies.includes(allergy)}
                            onCheckedChange={() => toggleItem(allergy, selectedAllergies, setSelectedAllergies)}
                          />
                          <label htmlFor={`allergy-${allergy}`} className="text-sm font-medium leading-none cursor-pointer">
                            {allergy}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Workout Location */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Workout Location</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {LOCATION_VALUES.map((loc) => (
                        <div key={loc} className="flex items-center space-x-2">
                          <Checkbox
                            id={`loc-${loc}`}
                            checked={selectedLocations.includes(loc)}
                            onCheckedChange={() => toggleItem(loc, selectedLocations, setSelectedLocations)}
                          />
                          <label htmlFor={`loc-${loc}`} className="text-sm font-medium leading-none cursor-pointer">
                            {LOCATION_LABELS[loc]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Goals */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fitness Targets</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {GOAL_OPTIONS.map((goal) => (
                        <div key={goal} className="flex items-center space-x-2">
                          <Checkbox
                            id={`goal-${goal}`}
                            checked={selectedGoals.includes(goal)}
                            onCheckedChange={() => toggleItem(goal, selectedGoals, setSelectedGoals)}
                          />
                          <label htmlFor={`goal-${goal}`} className="text-sm font-medium leading-none cursor-pointer">
                            {goal}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Macro overrides */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Macro Target Override</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Input
                          type="number"
                          placeholder="P (g)"
                          value={proteinG}
                          onChange={(e) => setProteinG(e.target.value)}
                          className="bg-background/50 h-10 font-mono text-center"
                        />
                        <p className="text-center text-[10px] uppercase text-muted-foreground mt-1">Protein</p>
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="C (g)"
                          value={carbsG}
                          onChange={(e) => setCarbsG(e.target.value)}
                          className="bg-background/50 h-10 font-mono text-center"
                        />
                        <p className="text-center text-[10px] uppercase text-muted-foreground mt-1">Carbs</p>
                      </div>
                      <div>
                        <Input
                          type="number"
                          placeholder="F (g)"
                          value={fatG}
                          onChange={(e) => setFatG(e.target.value)}
                          className="bg-background/50 h-10 font-mono text-center"
                        />
                        <p className="text-center text-[10px] uppercase text-muted-foreground mt-1">Fat</p>
                      </div>
                    </div>
                  </div>

                  {/* Velocity */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Velocity of Plan</Label>
                    <Select value={velocity} onValueChange={setVelocity}>
                      <SelectTrigger className="w-full bg-background/50">
                        <SelectValue placeholder="Velocity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="ai-recommended">AI Recommended</SelectItem>
                        <SelectItem value="fast">Fast</SelectItem>
                      </SelectContent>
                    </Select>
                    {velocity === "fast" ? (
                      <p className="text-xs text-red-500 font-bold mt-2 py-1.5 px-3 bg-red-500/10 rounded border border-red-500/20">
                        Warning: Fast velocity may lead to muscle loss and fatigue.
                      </p>
                    ) : (
                      <p className="text-xs text-emerald-500 font-bold mt-2 py-1.5 px-3 bg-emerald-500/10 rounded border border-emerald-500/20">
                        Optimum range. You will improve muscle construction.
                      </p>
                    )}
                  </div>

                  {/* Activity Level */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Activity Level</Label>
                    <Select value={activityLevel} onValueChange={setActivityLevel}>
                      <SelectTrigger className="w-full bg-background/50">
                        <SelectValue placeholder="Activity Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SEDENTARY">Sedentary</SelectItem>
                        <SelectItem value="LIGHTLY_ACTIVE">Lightly Active</SelectItem>
                        <SelectItem value="MODERATELY_ACTIVE">Moderately Active</SelectItem>
                        <SelectItem value="VERY_ACTIVE">Very Active</SelectItem>
                        <SelectItem value="ATHLETE">Athlete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-8 mt-6 border-t border-border/50">
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Sync Parameters
                </Button>
              </div>
            </div>
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────────────── */}
          <div className="space-y-6">
            <div className="glass-card p-6 border-t-2 border-t-primary">
              <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Notification Directives
              </h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-foreground">Training Ping</Label>
                    <p className="text-xs text-muted-foreground">Reminders 1h before schedule</p>
                  </div>
                  <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
                </div>
                <div className="flex items-center justify-between opacity-60">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-foreground">Meal Prep Ping</Label>
                    <p className="text-xs text-muted-foreground">Weekly shopping alerts</p>
                  </div>
                  <Switch disabled checked={true} />
                </div>
                <div className="flex items-center justify-between opacity-60">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-foreground">Squad Alerts</Label>
                    <p className="text-xs text-muted-foreground">When friends finish protocol</p>
                  </div>
                  <Switch disabled checked={true} />
                </div>
              </div>
            </div>

            <div className="glass-card p-6 bg-secondary/10">
              <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Security
              </h2>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-between h-10 font-mono text-xs">
                  Change Password <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" className="w-full justify-between h-10 font-mono text-xs">
                  Two-Factor Auth <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="destructive" onClick={handleLogout} className="w-full gap-2 mt-4 font-bold border-none">
                  <LogOut className="h-4 w-4" /> Log Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
