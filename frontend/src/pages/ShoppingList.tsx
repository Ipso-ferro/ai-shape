import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ShoppingCart, Check, RefreshCw, Layers, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

const initialItems = [
  { id: 1, name: "Chicken breast", qty: "1.5 kg", category: "Protein", checked: false },
  { id: 2, name: "Eggs", qty: "2 dozen", category: "Protein", checked: false },
  { id: 3, name: "Greek yogurt", qty: "32 oz", category: "Protein", checked: false },
  { id: 4, name: "Jasmine rice", qty: "1 kg", category: "Carbs", checked: false },
  { id: 5, name: "Sweet potatoes", qty: "1 kg", category: "Carbs", checked: true },
  { id: 6, name: "Spinach", qty: "2 bags", category: "Veggies", checked: false },
  { id: 7, name: "Broccoli", qty: "3 heads", category: "Veggies", checked: true },
  { id: 8, name: "Olive oil", qty: "1 bottle", category: "Fats", checked: false },
];

export default function ShoppingList() {
  const [items, setItems] = useState<any[]>(initialItems);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const { user } = useAuth();
  const isPro = user?.isPro || false;

  const fetchShoppingList = async () => {
    try {
      const data = await api.get<any[]>('/api/v1/ai/shopping-list');
      if (data && Array.isArray(data) && data.length > 0) {
        setItems(data);
      }
    } catch (err) {
      console.error("Failed to fetch shopping list", err);
    }
  };

  useEffect(() => {
    if (user) fetchShoppingList();
  }, [user]);

  const toggleItem = (id: string | number) => {
    // Note: This only toggles locally for now to keep things snappy, 
    // real persistence logic could be added using another route if needed.
    setItems(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  };

  const generateList = async () => {
    if (!isPro) return;
    setIsGenerating(true);
    try {
      await api.post("/api/v1/ai/generate-shopping-list", {});
      toast({
        title: "List Generated",
        description: "Your shopping list has been synchronized.",
      });
      await fetchShoppingList();
    } catch (err: any) {
      toast({
        title: "Generation Failed",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const { dateRangeStr } = useMemo(() => {
    const today = new Date();
    // find most recent Monday
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return {
      dateRangeStr: `${monday.toLocaleDateString(undefined, options)} - ${sunday.toLocaleDateString(undefined, options)}`
    };
  }, []);

  const categories = Array.from(new Set(items.map((i) => i.category)));
  const checkedCount = items.filter((i) => i.checked).length;
  const progress = Math.round((checkedCount / items.length) * 100);

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0 max-w-4xl mx-auto">
        <div className="relative">
          <div className={`space-y-8 transition-all duration-300 ${!isPro ? "blur-md pointer-events-none opacity-50" : ""}`}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-4">
                  <Layers className="h-3.5 w-3.5" /> Auto-Renewing List
                </div>
                <h1 className="text-4xl font-display font-black tracking-tighter">Shopping List</h1>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  Target week: <strong className="text-foreground">{dateRangeStr}</strong>. Generated fresh every Sunday.
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                  <ShoppingCart className="h-4 w-4" />
                  {checkedCount}/{items.length} items collected ({progress}%)
                </div>
                <Button
                  size="lg"
                  onClick={generateList}
                  disabled={isGenerating}
                  className="gap-2 shrink-0 rounded-xl"
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                  {isGenerating ? "Generating..." : "Generate Weekly List"}
                </Button>
              </div>
            </div>

            <div className="space-y-8">
              {categories.map((cat) => {
                const catItems = items.filter((i) => i.category === cat);
                const allChecked = catItems.every((i) => i.checked);

                return (
                  <div key={cat} className={`glass-card overflow-hidden transition-opacity ${allChecked ? "opacity-60" : ""}`}>
                    <div className="p-4 border-b border-border/50 bg-secondary/20 flex items-center justify-between">
                      <h3 className="font-display font-bold uppercase tracking-widest text-sm">{cat}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{catItems.filter(i => i.checked).length}/{catItems.length}</span>
                    </div>
                    <div className="divide-y divide-border/20">
                      {catItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`w-full flex items-center gap-4 p-4 text-left hover:bg-secondary/10 transition-colors group ${item.checked ? "bg-secondary/5" : ""
                            }`}
                        >
                          <div
                            className={`h-6 w-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${item.checked ? "bg-primary border-primary" : "border-muted-foreground/30 group-hover:border-primary/50"
                              }`}
                          >
                            {item.checked && <Check className="h-4 w-4 text-primary-foreground" />}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium transition-colors ${item.checked ? "text-muted-foreground line-through" : "text-foreground"
                              }`}>
                              {item.name}
                            </p>
                          </div>
                          <span className="text-sm font-mono text-muted-foreground bg-background/50 px-2 py-1 rounded">
                            {item.qty}
                          </span>
                        </button>
                      ))}
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
                  Automated weekly grocery extraction is reserved for Pro operators.
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
