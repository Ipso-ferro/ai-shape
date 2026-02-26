import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function Privacy() {
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
                <h1 className="text-5xl font-display font-black tracking-tight mb-4">Privacy Policy</h1>
                <div className="space-y-6 text-muted-foreground">
                    <p>
                        <strong>Last Updated: {new Date().toLocaleDateString()}</strong>
                    </p>
                    <p>
                        This Privacy Policy outlines how ai-shape collects, uses, and safeguards your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">1. Collection of Data</h2>
                    <p>
                        We collect biometric data, health metrics, and OS-integrated inputs solely to compute and recalibrate your training routines and meal plans. This includes heart rate variance, basal metabolic rate estimates, and training volume history.
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">2. Usage and Protection</h2>
                    <p>
                        Your data is stored securely using industry-standard encryption protocols. We do not sell your personal health metrics to third parties. Data is only utilized by our proprietary AI engine to generate your specific directives.
                    </p>
                    <h2 className="text-2xl font-bold text-foreground">3. Your Rights</h2>
                    <p>
                        Under the Australian Privacy Act, you have the right to request access to the personal information we hold about you and to ask for corrections if it is inaccurate. To initiate a data request, contact our administration link in your operator profile.
                    </p>
                </div>
            </div>
        </div>
    );
}
