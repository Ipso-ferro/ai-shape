import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { CreditCard, Check, Tag, ShieldCheck, ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Billing() {
  const [isYearly, setIsYearly] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  const basePrice = 15;
  const yearlyPrice = basePrice * 12 * 0.8; // 20% off
  const monthlyDisplay = isYearly ? (yearlyPrice / 12).toFixed(2) : basePrice;

  const handleApplyCoupon = () => {
    if (!couponCode) return;
    setCouponApplied(true);
    alert(`Coupon code "${couponCode}" applied successfully! (Simulated)`);
  };

  const handleCheckout = () => {
    alert("Redirecting to secured Shopify/Strapi payment gateway... (Simulation)");
  };

  return (
    <AppLayout>
      <div className="space-y-8 pt-12 md:pt-0 max-w-4xl mx-auto">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-display font-bold tracking-tight">Level Up Your Training</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get unlimited AI generation, custom meal plans, biometric tracking, and priority support.
          </p>
        </div>

        {/* Pricing Toggle */}
        <div className="flex items-center justify-center gap-4 py-4">
          <span className={`text-sm font-medium ${!isYearly ? "text-foreground" : "text-muted-foreground"}`}>Billed Monthly</span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <span className={`flex items-center gap-2 text-sm font-medium ${isYearly ? "text-foreground" : "text-muted-foreground"}`}>
            Billed Yearly <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">Save 20%</span>
          </span>
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-start mt-8">

          {/* Plan Details Card */}
          <div className="md:col-span-3 glass-card p-8 border-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="flex justify-between items-start mb-6">
              <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-glow p-2 text-primary">
                <Logo className="h-full w-full" />
              </div>
              <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-primary/30">
                Most Popular
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-display font-black tracking-tighter">${monthlyDisplay}</span>
              <span className="text-muted-foreground">/ month</span>
            </div>

            {isYearly && (
              <p className="text-sm text-primary font-medium mb-6 animate-slide-up">
                Billed ${yearlyPrice.toFixed(2)} annually. You're saving $36 a year!
              </p>
            )}

            <ul className="space-y-4 mb-8">
              {["Unlimited AI plan generation", "Custom macro-optimized meals", "Progressive overload workouts", "Automated shopping lists", "Advanced biometric tracking", "Priority engineering support"].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-foreground/90">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Checkout & Coupon Sidebar */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-card p-6 border-l-2 border-l-border bg-secondary/20">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" /> Have a Coupon?
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="bg-background/50 uppercase font-mono text-sm"
                  disabled={couponApplied}
                />
                <Button
                  variant="secondary"
                  onClick={handleApplyCoupon}
                  disabled={!couponCode || couponApplied}
                >
                  {couponApplied ? "Applied" : "Apply"}
                </Button>
              </div>
              {couponApplied && (
                <p className="text-xs text-primary mt-2 font-medium">✨ Discount applied to checkout.</p>
              )}
            </div>

            <div className="glass-card p-6 border border-border/50">
              <div className="flex items-center justify-between font-display font-bold text-lg mb-6">
                <span>Total Due Today</span>
                <span>${isYearly ? yearlyPrice.toFixed(2) : basePrice.toFixed(2)}</span>
              </div>

              <Button onClick={handleCheckout} className="w-full relative overflow-hidden group h-14 text-lg">
                <span className="relative z-10 flex items-center gap-2">
                  Complete Activation <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              </Button>

              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
                <ShieldCheck className="h-4 w-4" /> Secured by Shopify & Strapi
              </div>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-display font-bold">Current Status</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">You are currently on the Free Tier limited to 1 AI generation per week.</p>
              <Button variant="outline" className="w-full text-xs" disabled>Active: Free Plan</Button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
