import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function About() {
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
                <h1 className="text-5xl font-display font-black tracking-tight mb-4">About Us</h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    ai-shape is the world's most advanced artificial intelligence fitness operator. We were founded on the principle that the human body operates as a complex system of inputs and outputs. Since our inception, we have optimized thousands of training protocols and nutritional matrices to deliver guaranteed results.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                    Based in Australia and operating globally, our algorithms ensure that your protocol is always uniquely adapted to your biometric reality. We believe in high standards, rigorous discipline, and data-driven adaptations. Welcome to the future of high-performance bodily reconstruction.
                </p>
            </div>
        </div>
    );
}
