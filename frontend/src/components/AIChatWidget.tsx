import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

interface AIChatWidgetProps {
    context?: "meal" | "workout" | "biometrics" | "dashboard" | "general";
    suggestions?: string[];
    onPlanUpdated?: (type: "diet" | "workout") => void;
}

type ChatResult = {
    planType?: "diet" | "workout";
    plan?: { summary?: string };
    mcpChanges?: Array<{ field: string; from: unknown; to: unknown }>;
};

export function AIChatWidget({ context = "general", suggestions = [], onPlanUpdated }: AIChatWidgetProps) {
    const [prompt, setPrompt] = useState("");
    const [isSending, setIsSending] = useState(false);

    const initialMessage = (() => {
        switch (context) {
            case "dashboard": return "I'm analyzing your macroscopic trends. Ask me for a summary or to project your compliance!";
            case "meal": return "Hey! I'm your AI nutrition coach. Ask me for meal prep tips or recipe substitutions.";
            case "workout": return "Hi! Need form tips or an alternative exercise? Ask away!";
            case "biometrics": return "Hello! I can analyze your health trends or give advice on connecting apps. How can I help?";
            default: return "Hey! I'm your AI coach. Tell me what you'd like to change about your plans.";
        }
    })();

    const [messages, setMessages] = useState<{ role: string; content: string }[]>([
        { role: "assistant", content: initialMessage },
    ]);

    const chooseEndpoint = (text: string) => {
        const looksWorkout = /(workout|exercise|sets|reps|gym|train|muscle|cardio)/i.test(text);
        if (context === "workout" || (context !== "meal" && looksWorkout)) {
            return "/api/v1/ai/workout/message";
        }
        return "/api/v1/ai/diet/message";
    };

    const send = async () => {
        if (!prompt.trim()) return;
        const userMessage = prompt.trim();
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setPrompt("");
        setIsSending(true);

        try {
            const endpoint = chooseEndpoint(userMessage);
            const data = await api.post<ChatResult>(endpoint, { message: userMessage });
            const summary = data?.plan?.summary || "Plan updated.";
            const mcpLine = (data?.mcpChanges?.length || 0) > 0
                ? `\nProfile updated: ${data.mcpChanges!.map((c) => c.field).join(", ")}.`
                : "";

            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `${summary}${mcpLine}` },
            ]);

            if (data.planType === "diet" || data.planType === "workout") {
                onPlanUpdated?.(data.planType);
            }
        } catch (error: unknown) {
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: (error as Error).message || "Unable to process the request right now." },
            ]);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-4">
            {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                        <button
                            key={s}
                            onClick={() => setPrompt(s)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            <div className="glass-card p-4 space-y-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                            className={`max-w-[80%] px-4 py-3 rounded-xl text-sm ${m.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground"
                                }`}
                        >
                            {m.content}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3">
                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask me anything..."
                    className="min-h-[48px] max-h-32 resize-none"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                        }
                    }}
                />
                <Button onClick={() => void send()} size="icon" className="shrink-0 h-12 w-12" disabled={isSending}>
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
