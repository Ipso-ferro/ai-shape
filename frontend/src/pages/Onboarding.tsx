import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Target, Dumbbell, Utensils, AlertTriangle, Home } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const goals = ["Lose Weight", "Build Muscle", "Maintain", "Improve Health", "Athletic Performance"];
const activityLevels = ["Sedentary", "Lightly Active", "Moderately Active", "Very Active", "Athlete"];
const diets = ["No Preference", "Vegetarian", "Vegan", "Keto", "Paleo", "Mediterranean"];
const allergies = ["None", "Gluten", "Dairy", "Nuts", "Shellfish", "Soy", "Eggs", "Fish", "Wheat"];
const locations = ["Gym Facility", "Home Setup", "Calisthenics (No Equipment)"];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [selectedActivity, setSelectedActivity] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [mealsPerDay, setMealsPerDay] = useState("");
  const navigate = useNavigate();
  const { setUserDirectly } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const totalSteps = 7;

  const isStepValid = () => {
    switch (step) {
      case 0: return selectedGoals.length > 0;
      case 1:
        return gender !== "" &&
          age.trim() !== "" && parseInt(age) > 15 && parseInt(age) <= 110 &&
          height.trim() !== "" && parseInt(height) > 120 && parseInt(height) <= 220 &&
          weight.trim() !== "" && parseInt(weight) > 25 && parseInt(weight) <= 200 &&
          targetWeight.trim() !== "" && parseInt(targetWeight) > 25 && parseInt(targetWeight) <= 110;
      case 2: return selectedDiets.length > 0;
      case 3: return selectedAllergies.length > 0;
      case 4: return selectedLocations.length > 0;
      case 5: return selectedActivity !== "";
      case 6: return mealsPerDay !== "" && parseInt(mealsPerDay) >= 1 && parseInt(mealsPerDay) <= 6;
      default: return false;
    }
  };

  const toggleMulti = (value: string, list: string[], setList: (v: string[]) => void) => {
    if (value === "None") {
      setList(list.includes("None") ? [] : ["None"]);
      return;
    }
    const filteredList = list.filter((v) => v !== "None");
    setList(filteredList.includes(value) ? filteredList.filter((v) => v !== value) : [...filteredList, value]);
  };

  const locationMap: Record<string, string> = { "Gym Facility": "GYM", "Home Setup": "HOME", "Calisthenics (No Equipment)": "CALISTHENICS" };
  const activityMap: Record<string, string> = { "Sedentary": "SEDENTARY", "Lightly Active": "LIGHTLY_ACTIVE", "Moderately Active": "MODERATELY_ACTIVE", "Very Active": "VERY_ACTIVE", "Athlete": "ATHLETE" };

  const next = async () => {
    if (step < totalSteps - 1) { setStep(step + 1); return; }
    const pending = sessionStorage.getItem("pending_register");
    if (!pending) { navigate("/dashboard"); return; }
    const { email, password } = JSON.parse(pending);
    setIsSubmitting(true); setSubmitError("");
    try {
      const data = await api.post<{ user: { id: string; email: string; isPro: boolean; subscriptionTier?: string } }>("/api/v1/auth/register", {
        email, password,
        gender: gender === "Male" ? "MALE" : "FEMALE",
        ageYrs: parseInt(age), heightCm: parseFloat(height),
        weightKg: parseFloat(weight), targetWeightKg: parseFloat(targetWeight),
        goals: selectedGoals,
        workoutLocations: selectedLocations.map((l) => locationMap[l] || l),
        diets: selectedDiets, allergies: selectedAllergies,
        activityLevel: activityMap[selectedActivity] || "SEDENTARY",
        mealsPerDay: parseInt(mealsPerDay),
      });
      sessionStorage.removeItem("pending_register");
      setUserDirectly(data.user);
      navigate("/dashboard");
    } catch (err: unknown) {
      setSubmitError((err as Error).message || "Registration failed. Please try again.");
    } finally { setIsSubmitting(false); }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const stepIcons = [Target, Dumbbell, Utensils, AlertTriangle, Home, Dumbbell, Logo];
  const StepIcon = stepIcons[step] || Target;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"
                }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="glass-card p-8">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                <StepIcon className="h-6 w-6 text-primary" />
              </div>

              {step === 0 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">What are your goals?</h2>
                  <p className="text-sm text-muted-foreground mb-6">Select all that apply.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {goals.map((g) => (
                      <button
                        key={g}
                        onClick={() => toggleMulti(g, selectedGoals, setSelectedGoals)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${selectedGoals.includes(g)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                          }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Your stats</h2>
                  <p className="text-sm text-muted-foreground mb-6">We use this to calculate your macros.</p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={() => setGender("Male")}
                      className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${gender === "Male" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                    >
                      Male
                    </button>
                    <button
                      onClick={() => setGender("Female")}
                      className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${gender === "Female" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                    >
                      Female
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Age</Label>
                      <Input type="number" placeholder="25" className={`mt-1.5 ${age && (parseInt(age) <= 15 || parseInt(age) > 110) ? 'border-red-500' : ''}`} value={age} onChange={(e) => setAge(e.target.value)} />
                    </div>
                    <div>
                      <Label>Height (cm)</Label>
                      <Input type="number" placeholder="175" className={`mt-1.5 ${height && (parseInt(height) <= 120 || parseInt(height) > 220) ? 'border-red-500' : ''}`} value={height} onChange={(e) => setHeight(e.target.value)} />
                    </div>
                    <div>
                      <Label>Weight (kg)</Label>
                      <Input type="number" placeholder="75" className={`mt-1.5 ${weight && (parseInt(weight) <= 25 || parseInt(weight) > 200) ? 'border-red-500' : ''}`} value={weight} onChange={(e) => setWeight(e.target.value)} />
                    </div>
                    <div>
                      <Label>Target (kg)</Label>
                      <Input type="number" placeholder="70" className={`mt-1.5 ${targetWeight && (parseInt(targetWeight) <= 25 || parseInt(targetWeight) > 110) ? 'border-red-500' : ''}`} value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} />
                    </div>
                  </div>

                  {(!isStepValid() && (age.trim() !== "" || height.trim() !== "" || weight.trim() !== "" || targetWeight.trim() !== "")) && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 font-medium">
                      Please enter correct information to proceed. All fields are required with valid minimums.
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Diet preference</h2>
                  <p className="text-sm text-muted-foreground mb-6">Select all that apply.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {diets.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleMulti(d, selectedDiets, setSelectedDiets)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${selectedDiets.includes(d)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                          }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Any allergies?</h2>
                  <p className="text-sm text-muted-foreground mb-6">Select all that apply so we can keep you safe.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {allergies.map((a) => (
                      <button
                        key={a}
                        onClick={() => toggleMulti(a, selectedAllergies, setSelectedAllergies)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium border transition-all ${selectedAllergies.includes(a)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                          }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Workout Location</h2>
                  <p className="text-sm text-muted-foreground mb-6">Select all that apply.</p>
                  <div className="space-y-3">
                    {locations.map((l) => (
                      <button
                        key={l}
                        onClick={() => toggleMulti(l, selectedLocations, setSelectedLocations)}
                        className={`w-full px-4 py-3 rounded-lg text-sm font-medium border text-left transition-all ${selectedLocations.includes(l)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                          }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Activity level</h2>
                  <p className="text-sm text-muted-foreground mb-6">How active are you currently?</p>
                  <div className="space-y-3">
                    {activityLevels.map((a) => (
                      <button
                        key={a}
                        onClick={() => setSelectedActivity(a)}
                        className={`w-full px-4 py-3 rounded-lg text-sm font-medium border text-left transition-all ${selectedActivity === a
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                          }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 6 && (
                <div>
                  <h2 className="text-2xl font-display font-bold mb-2">Meals per day</h2>
                  <p className="text-sm text-muted-foreground mb-6">How many meals do you prefer to eat per day? (1 - 6)</p>
                  <div className="space-y-3">
                    <Input
                      type="number"
                      placeholder="e.g. 3"
                      className={`mt-1.5 ${mealsPerDay && (parseInt(mealsPerDay) < 1 || parseInt(mealsPerDay) > 6) ? 'border-red-500' : ''}`}
                      value={mealsPerDay}
                      onChange={(e) => setMealsPerDay(e.target.value)}
                    />
                    {mealsPerDay && (parseInt(mealsPerDay) < 1 || parseInt(mealsPerDay) > 6) && (
                      <p className="text-xs text-red-500 font-medium">Please enter a number between 1 and 6.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-col gap-3 mt-6">
          {submitError && <p className="text-sm text-red-500 text-center">{submitError}</p>}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={prev} disabled={step === 0 || isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button onClick={next} disabled={!isStepValid() || isSubmitting}>
              {isSubmitting ? "Creating account..." : step === totalSteps - 1 ? "Finish" : "Continue"} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
