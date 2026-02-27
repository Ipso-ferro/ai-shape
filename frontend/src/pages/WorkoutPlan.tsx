import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Calendar, PlayCircle, CheckCircle2, ChevronLeft, ArrowUpRight, Flame, Video, Lock, Sparkles, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatWidget } from "@/components/AIChatWidget";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WorkoutPlan() {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [completedExercises, setCompletedExercises] = useState<Record<string, boolean>>({});
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [currentVideoExc, setCurrentVideoExc] = useState("");
  const location = useLocation();

  const { user } = useAuth();
  const isPro = user?.isPro || false;
  const { toast } = useToast();

  const [scheduleData, setScheduleData] = useState<any>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset to weekly view whenever navigating to this page
  useEffect(() => {
    setSelectedDay(null);
  }, [location.pathname]);

  const fetchWorkoutPlan = async () => {
    try {
      const data = await api.get<any[]>('/api/v1/ai/workout-plan');
      if (data && data.length > 0) {
        const formatted: Record<string, any> = {};
        for (const d of data) {
          formatted[d.weekday] = {
            name: d.name,
            duration: `${d.durationMin} min`,
            intensity: d.intensity,
            exercises: d.exercises.map((e: any) => ({
              name: e.name, sets: e.sets, notes: e.notes
            }))
          };
        }
        setScheduleData(formatted);
      } else {
        setScheduleData(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  useEffect(() => {
    if (user) fetchWorkoutPlan();
  }, [user]);

  const handleGeneratePlan = async () => {
    if (!isPro) return;
    setIsGenerating(true);
    try {
      await api.post('/api/v1/ai/generate-workout-plan', {});
      toast({ title: "Plan Generated", description: "Your workout matrix has been created." });
      await fetchWorkoutPlan();
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExercise = (ex: string) => {
    setCompletedExercises((prev) => ({ ...prev, [ex]: !prev[ex] }));
  };

  const scheduleInCalendar = () => {
    window.open("https://calendar.google.com/calendar/r/eventedit?text=Workout&details=Scheduled%20workout%20from%20ai-shape", "_blank");
  };

  const openVideo = (exerciseName: string) => {
    setCurrentVideoExc(exerciseName);
    setVideoModalOpen(true);
  };

  if (selectedDay) {
    const w = scheduleData[selectedDay as keyof typeof scheduleData];
    const isRest = w.exercises && w.exercises.length === 0;

    return (
      <AppLayout>
        <div className="relative">
          <div className={`space-y-6 pt-12 md:pt-0 max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500 transition-all duration-300 ${!isPro ? "blur-md pointer-events-none opacity-50" : ""}`}>
            <Button variant="ghost" onClick={() => setSelectedDay(null)} className="gap-2 -ml-4 pl-2 hover:bg-transparent hover:text-primary">
              <ChevronLeft className="h-4 w-4" /> Back to Weekly Overview
            </Button>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3">
                  {selectedDay}
                </div>
                <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter">{w.name}</h1>
                <p className="text-muted-foreground font-mono mt-2 flex items-center gap-3">
                  <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {w.duration}</span>
                  <span className="flex items-center gap-1.5"><Flame className="h-4 w-4" /> {w.intensity}</span>
                </p>
              </div>
              {!isRest && (
                <Button onClick={scheduleInCalendar} className="gap-2 h-12 rounded-xl" size="lg">
                  <Calendar className="h-4 w-4" /> Schedule in GCal
                </Button>
              )}
            </div>

            {!isRest && w.exercises ? (
              <div className="grid md:grid-cols-3 gap-8 mt-8">
                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-xl font-display font-bold border-b border-border/50 pb-2 mb-4">Training Block</h3>
                  {w.exercises.map((ex, i) => {
                    const isDone = completedExercises[ex.name];
                    return (
                      <div key={i} className={`glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-all ${isDone ? 'opacity-60 bg-secondary/10 border-primary/20' : 'hover:border-primary/50'}`}>
                        <button
                          onClick={() => toggleExercise(ex.name)}
                          className={`h-8 w-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground hover:border-primary'}`}
                        >
                          {isDone && <CheckCircle2 className="h-5 w-5" />}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className={`font-bold font-display text-lg ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{ex.name}</h4>
                              <p className="text-sm font-mono text-primary mt-1">{ex.sets}</p>
                            </div>
                            <Button variant="secondary" size="sm" className="gap-2 shrink-0 rounded-full" onClick={() => openVideo(ex.name)}>
                              <PlayCircle className="h-4 w-4" /> <span className="hidden sm:inline">Watch Form</span>
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-3 bg-background/50 p-2 rounded border border-border/30 inline-flex">💡 Note: {ex.notes}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-6">
                  <div className="glass-card p-6 border-l-2 border-l-primary relative overflow-hidden">
                    <Flame className="absolute -bottom-4 -right-4 h-32 w-32 text-primary/10 pointer-events-none" />
                    <h3 className="font-display font-bold text-xl mb-4 relative z-10">AI Training Assistant</h3>
                    <div className="relative z-10">
                      <AIChatWidget
                        context="workout"
                        suggestions={[
                          "Alternative for " + w.exercises[0]?.name + "?",
                          "My shoulders hurt, modifications?",
                          "How long should I rest between sets?"
                        ]}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center mt-8 border-dashed border-2 border-border/50 bg-secondary/5">
                <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Calendar className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-2xl font-display font-bold mb-2">Rest & Recover</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  No active training block scheduled today. Focus on mobility, hydration, and sleep to maximize your recovery.
                </p>
              </div>
            )}
          </div>

          {!isPro && (
            <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <div className="glass-card w-full max-w-sm p-8 shadow-2xl border-primary/30 flex flex-col items-center bg-background/95 backdrop-blur-xl">
                <div className="h-16 w-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                  <Lock className="h-8 w-8" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Pro Access Required</h3>
                <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                  Daily workout execution and exercise matrices are reserved for Pro operators.
                </p>
                <Link to="/billing" className="w-full">
                  <Button className="w-full font-bold shadow-glow text-md h-12">
                    Upgrade to Pro <Sparkles className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors pointer-events-auto relative z-30"
                >
                  Return to Weekly Overview
                </button>
              </div>
            </div>
          )}
        </div>

        <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
          <DialogContent className="sm:max-w-2xl bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Form Tutorial: {currentVideoExc}</DialogTitle>
              <DialogDescription>
                Watch the biomechanical breakdown and execution form below.
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video bg-black rounded-lg border border-border/50 flex flex-col items-center justify-center relative overflow-hidden group">
              <Video className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-mono text-sm">(Simulated Video Player)</p>
              <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors cursor-pointer flex items-center justify-center">
                <PlayCircle className="h-20 w-20 text-white/50 group-hover:text-primary transition-colors drop-shadow-xl" />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => setVideoModalOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

      </AppLayout>
    );
  }

  // Weekly Overview (Default)
  return (
    <AppLayout>
      <div className="space-y-12 pt-12 md:pt-0 max-w-6xl mx-auto overflow-hidden">
        {!scheduleData && !isLoadingPlan ? (
          <div className="glass-card p-12 text-center mt-8 border-dashed border-2 border-border/50 bg-secondary/5 flex flex-col items-center justify-center min-h-[400px]">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Activity className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-3xl font-display font-bold mb-4">No Workout Matrix Active</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Your personal trainer is standing by. Generate a highly optimized weekly training regimen designed specifically for your goals and biometrics.
            </p>
            {isPro ? (
              <Button onClick={handleGeneratePlan} disabled={isGenerating} size="lg" className="shadow-glow h-14 px-8 text-lg font-bold">
                <Sparkles className={`h-5 w-5 mr-2 ${isGenerating ? 'animate-spin' : 'text-yellow-400'}`} />
                {isGenerating ? "Generating..." : "Generate AI Routine"}
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
            <div className={`space-y-12 transition-all duration-300 ${!isPro ? "blur-md pointer-events-none opacity-50" : ""}`}>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4 md:px-0">
                <div className="space-y-4">
                  <h1 className="text-5xl font-display font-black tracking-tighter uppercase relative inline-block">
                    Training <span className="text-primary">Routine</span>
                  </h1>
                  <p className="text-lg text-muted-foreground">Select a module to view the workout matrix, log sets, and analyze biomechanics.</p>
                </div>
                {isPro && scheduleData && (
                  <Button onClick={handleGeneratePlan} disabled={isGenerating} className="shadow-glow hover:bg-primary/90 transition-all font-bold self-start md:self-auto mt-4 md:mt-0">
                    <Sparkles className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : 'text-yellow-400'}`} />
                    {isGenerating ? "Generating..." : "Regenerate Plan"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)] justify-center">
                {scheduleData && days.map((day) => {
                  const w = scheduleData[day as keyof typeof scheduleData];
                  if (!w) return null;
                  const isRest = w.name.includes("Rest") || w.name.includes("Recovery");
                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`glass-card p-6 cursor-pointer group flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1 ${isRest
                        ? "opacity-60 hover:opacity-100 border-dashed border-border/50 bg-secondary/10"
                        : "hover:border-primary/50 hover:shadow-glow bg-card/40"
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">{day}</span>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="font-display font-bold text-xl leading-tight text-foreground">{w.name}</h3>
                      </div>

                      <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border/30">
                        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {w.duration}
                        </div>
                        {!isRest && (
                          <div className="flex items-center gap-1.5 text-xs font-mono text-primary">
                            <Flame className="h-3.5 w-3.5" />
                            {w.intensity}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {!isPro && (
              <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center p-6 text-center">
                <div className="glass-card w-full max-w-sm p-8 shadow-2xl border-primary/30 flex flex-col items-center bg-background/95 backdrop-blur-xl">
                  <div className="h-16 w-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                    <Lock className="h-8 w-8" />
                  </div>
                  <h3 className="font-display font-bold text-2xl mb-2">Pro Access Required</h3>
                  <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                    The complete Routine and progressive overload matrices are reserved for Pro operators.
                  </p>
                  <Link to="/billing" className="w-full">
                    <Button className="w-full font-bold shadow-glow text-md h-12">
                      Upgrade to Pro <Sparkles className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
