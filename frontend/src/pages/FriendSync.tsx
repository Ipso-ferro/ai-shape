import { AppLayout } from "@/components/AppLayout";
import { Users, UserPlus, Share2, Check, Clock, Flame, ShieldAlert, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";

const friends = [
  { name: "Alex Turner", status: "synced", plan: "Meal + Workout", avatar: "AT", streak: 14 },
  { name: "Jordan Lee", status: "pending", plan: "Meal Plan", avatar: "JL", streak: 0 },
  { name: "Casey Kim", status: "synced", plan: "Workout Plan", avatar: "CK", streak: 85 },
];

export default function FriendSync() {
  const { user } = useAuth();
  const isPro = user?.isPro || false;

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
              <Users className="h-3.5 w-3.5" /> Social Framework
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter">Squad Sync</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">Amplify accountability by mirroring protocols.</p>
          </div>
        </div>

        <div className="relative">
          <div className={`grid md:grid-cols-5 gap-8 transition-all duration-300 ${!isPro ? "blur-md pointer-events-none opacity-50" : ""}`}>

            <div className="md:col-span-3 space-y-8">
              {/* Friends list */}
              <div className="glass-card border-none bg-transparent shadow-none">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display font-bold text-2xl">Active Operators</h2>
                  <span className="text-sm font-mono text-muted-foreground">{friends.length} Connections</span>
                </div>
                <div className="space-y-4">
                  {friends.map((f) => (
                    <div key={f.name} className="glass-card p-5 group hover:border-primary/50 transition-colors flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-12 w-12 rounded-xl bg-card border border-border/50 flex items-center justify-center text-sm font-bold shadow-inner group-hover:border-primary/30 transition-colors">
                          {f.avatar}
                        </div>
                        <div>
                          <p className="font-display font-bold text-lg leading-tight">{f.name}</p>
                          <p className="text-xs text-muted-foreground font-mono mt-1">Protocol: {f.plan}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-auto w-full border-t border-border/30 pt-4 sm:pt-0 sm:border-t-0">
                        {/* Racha / Streak Counter */}
                        {f.status === "synced" && (
                          <div className="flex flex-col items-center justify-center bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20" title={`${f.streak} Days Racha`}>
                            <div className="flex items-center gap-1.5 font-black text-primary font-mono text-lg leading-none">
                              <Flame className="h-4 w-4 fill-primary" /> {f.streak}
                            </div>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-primary/70">Racha</span>
                          </div>
                        )}

                        <div className="flex flex-col items-end gap-2">
                          {f.status === "synced" ? (
                            <span className="flex items-center gap-1.5 text-xs text-foreground font-bold uppercase tracking-wider bg-secondary px-2 py-1 rounded">
                              <Check className="h-3 w-3 text-primary" /> Synced
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold uppercase tracking-wider bg-background border border-border/50 px-2 py-1 rounded">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              {/* Invite */}
              <div className="glass-card p-6 border-t-2 border-t-primary">
                <div className="flex items-center gap-3 mb-6">
                  <UserPlus className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-bold text-xl">Sync Meal and Routine Plan</h2>
                </div>
                <div className="space-y-4">
                  <Input placeholder="TARGET EMAIL ADDRESS" className="h-12 uppercase font-mono text-sm bg-background/50" />
                  <Button className="w-full h-12 gap-2 text-primary-foreground font-bold tracking-wider">
                    <Share2 className="h-4 w-4" /> TRANSMIT PROTOCOL
                  </Button>
                </div>
              </div>

              {/* Shared plans info */}
              <div className="glass-card p-6 bg-secondary/10">
                <div className="flex items-start gap-4 text-muted-foreground hover:text-foreground transition-colors">
                  <ShieldAlert className="h-6 w-6 shrink-0 mt-1" />
                  <div className="space-y-2 text-sm">
                    <p><strong className="text-foreground">Synchronization Rules:</strong> Mirrors meal/workout protocols securely. Only verified accounts can parse your health matrix.</p>
                    <p>Maintain your <span className="text-primary font-bold">RACHA</span> (streak) by consistently fulfilling daily protocol objectives with synced operators.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Freemium Overlay Paywall */}
          {!isPro && (
            <div className="absolute inset-x-0 inset-y-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <div className="glass-card w-full max-w-sm p-8 shadow-2xl border-primary/30 flex flex-col items-center bg-background/95 backdrop-blur-xl">
                <div className="h-16 w-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                  <Lock className="h-8 w-8" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Pro Access Required</h3>
                <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                  Squad Sync and social accountability matrices are highly secure channels reserved for Pro operators.
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
      </div>
    </AppLayout>
  );
}
