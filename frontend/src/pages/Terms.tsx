import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function Terms() {
    return (
        <div className="min-h-screen pb-20 bg-background text-foreground">
            <div className="flex h-20 items-center justify-between px-6 border-b border-border/50">
                <Link to="/" className="flex gap-2 items-center">
                    <Logo className="h-8 w-8 text-primary" />
                    <span className="font-display font-bold tracking-tight text-xl">ai-shape</span>
                </Link>
            </div>
            <div className="pt-24 px-6 max-w-3xl mx-auto space-y-8">
                <Link to="/" className="text-primary hover:underline text-sm font-bold uppercase tracking-wider mb-8 inline-block">&larr; Back to Home</Link>
                <h1 className="text-5xl font-display font-black tracking-tight mb-4">Terms of Service</h1>
                <div className="space-y-6 text-muted-foreground">
                    <p>
                        <strong>Last Updated: {new Date().toLocaleDateString()}</strong>
                    </p>
                    <p>
                        By using the ai-shape application and services, you agree to comply with and be bound by the following terms and conditions of use, compliant with Australian Consumer Law (ACL).
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">1. User Obligations</h2>
                    <p>
                        You must provide accurate biometric data and adhere to the safety guidelines provided by the AI Training Assistant. ai-shape is not responsible for injuries sustained while ignoring protocol warnings.
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">2. Results Guarantee & Refunds</h2>
                    <p>
                        Our "100% Results Guaranteed" policy is in alignment with the Australian Competition and Consumer Commission (ACCC) guidelines. If you adhere strictly to the generated protocol (logging workouts and meals) and do not see measurable progress within 30 days, you are entitled to a full refund under the ACL minor/major failure clauses.
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">3. Modifications to Service</h2>
                    <p>
                        We reserve the right to modify or discontinue the service (or any part or content thereof) without notice at any time. Pricing for our Pro tier is subject to change.
                    </p>
                </div>
            </div>
        </div>
    );
}
