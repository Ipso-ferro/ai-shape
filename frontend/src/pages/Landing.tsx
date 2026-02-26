import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Utensils, Dumbbell, Sparkles, ArrowUpRight, Star, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useRef, useState, useEffect } from "react";

// Mock Data for Testimonials
const baseTestimonials = [
  {
    quote: "ai-shape completely changed my relation to food and the gym. It's like having a master trainer in my pocket.",
    author: "Sarah T.",
    role: "Lost 15 lbs in 3 months"
  },
  {
    quote: "The adaptive workouts are insane. Whenever I hit a plateau, the algorithm dynamically adjusts my volume. Pure genius.",
    author: "James L.",
    role: "Gained 8 lbs muscle"
  },
  {
    quote: "I never thought tracking macros could be this effortless. The automated grocery lists save me hours every week.",
    author: "Elena M.",
    role: "Marathon Finisher"
  },
  {
    quote: "100% accurate macro tracking. The recipe mode is something I use every single day.",
    author: "David O.",
    role: "Powerlifter"
  },
  {
    quote: "I tried everything before. This is the only system that actually learned my habits and adjusted.",
    author: "Jessica R.",
    role: "Lost 22 lbs"
  }
];

// Replicate to 30 cases to ensure smooth marquee scrolling
const testimonials = Array.from({ length: 30 }).map((_, i) => baseTestimonials[i % baseTestimonials.length]);

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentNutritionImg, setCurrentNutritionImg] = useState(0);
  const nutritionImages = ["/images/oatmeal.png", "/images/meal-ai.png"];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentNutritionImg((prev) => (prev + 1) % nutritionImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Global Scroll transforms
  const heroTextY = useTransform(scrollYProgress, [0, 0.2], [0, 150]);
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const mockupY = useTransform(scrollYProgress, [0, 0.3], [100, -150]);
  const mockupScale = useTransform(scrollYProgress, [0, 0.3], [1, 1.1]);

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden font-sans" ref={containerRef}>

      {/* Visual Noise Texture Overlay */}
      <div className="fixed inset-0 z-50 pointer-events-none opacity-[0.03] mix-blend-overlay"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}>
      </div>

      {/* Extreme Minimal Header */}
      <header className="fixed top-0 w-full z-50 mix-blend-difference bg-transparent backdrop-blur-none border-none text-white transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto px-6 h-28 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 flex items-center justify-center overflow-hidden">
              <Logo className="h-full w-full group-hover:rotate-90 transition-transform duration-700 ease-in-out text-primary" />
            </div>
            <span className="font-display font-bold tracking-tight text-xl hidden md:block">ai-shape</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-sm font-semibold tracking-wide hover:text-primary transition-colors">
              Log in
            </Link>
            <Link to="/auth?mode=signup">
              <Button className="rounded-full font-bold tracking-wide text-xs h-12 px-8 border border-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground backdrop-blur-md transition-all duration-300 shadow-glow">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.15),transparent_50%)] pointer-events-none" />

        <motion.div
          className="w-full max-w-[1400px] mx-auto text-center relative z-10 flex flex-col items-center"
          style={{ y: heroTextY, opacity: heroTextOpacity }}
        >
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest mb-10 backdrop-blur-md">
            <Sparkles className="h-4 w-4" />
            <span>The #1 AI Fitness System • Working since 2024</span>
          </div>

          <h1 className="text-[12vw] md:text-[8vw] leading-[0.9] font-black font-display tracking-tighter mb-8 relative">
            Build your best <br />
            <span className="text-primary italic font-light tracking-tight pr-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-green-400">body simply.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto mb-14 leading-relaxed">
            Forget the guesswork. Get a fully personalized diet and workout plan instantly, designed just for you by advanced AI.
          </p>

          {/* Trust Banner */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="flex gap-1 text-primary">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-primary" />)}
            </div>
            <p className="text-sm font-semibold tracking-wide text-foreground">Over 10,000+ bodies transformed</p>
          </div>
        </motion.div>

        {/* Mockup Product View (Parallaxing up) */}
        <motion.div
          className="relative z-20 mt-20 md:mt-0 md:absolute md:-bottom-24 md:right-[15%]"
          style={{ y: mockupY, scale: mockupScale }}
        >
          <div className="w-[320px] md:w-[400px] rounded-[2rem] overflow-hidden glass-card p-8 shadow-2xl shadow-primary/20 border border-primary/30 bg-background/80 backdrop-blur-3xl">
            <div className="flex justify-between items-center mb-8">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Dumbbell className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Today's Protocol</span>
            </div>
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-secondary/50 border border-border flex justify-between items-center transition-transform hover:scale-[1.02]">
                <div>
                  <h4 className="font-bold text-lg">Heavy Squats</h4>
                  <p className="text-sm text-muted-foreground mt-1">4 sets • 8-10 reps</p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div className="p-5 rounded-2xl bg-secondary/50 border border-border flex justify-between items-center opacity-60">
                <div>
                  <h4 className="font-bold text-lg">Leg Press</h4>
                  <p className="text-sm text-muted-foreground mt-1">3 sets • 12 reps</p>
                </div>
                <div className="h-6 w-6 rounded-full border-2 border-muted-foreground" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature 1: Nutrition (Alternating Layout) */}
      <section className="py-32 md:py-48 px-6 relative">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-32">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 w-full order-2 md:order-1 relative"
          >
            <div className="relative aspect-[4/5] md:aspect-[5/6] rounded-[2.5rem] glass-card overflow-hidden group border border-white/5 shadow-2xl transition-all hover:border-primary/20 bg-black/40">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentNutritionImg}
                  src={nutritionImages[currentNutritionImg]}
                  alt="Nutrition Interface"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />
              </AnimatePresence>
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2.5rem] pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent opacity-50 pointer-events-none" />
            </div>
          </motion.div>

          <div className="flex-1 space-y-10 order-1 md:order-2">
            <h2 className="text-[10vw] md:text-[5.5vw] font-black font-display tracking-tight leading-[1.1]">
              Nutrition, <br />
              <span className="text-primary italic font-light">simplified.</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
              Personalized meal plans created in seconds. We handle the macros so you can focus on eating well. Your meal plan automatically generates a precise shopping list. Never wonder what to buy at the store again.
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-center gap-4 font-semibold text-lg text-foreground/90">
                <CheckCircle2 className="h-6 w-6 text-primary" /> 100% Custom Meal Plans
              </li>
              <li className="flex items-center gap-4 font-semibold text-lg text-foreground/90">
                <CheckCircle2 className="h-6 w-6 text-primary" /> Automated Grocery Lists
              </li>
              <li className="flex items-center gap-4 font-semibold text-lg text-foreground/90">
                <CheckCircle2 className="h-6 w-6 text-primary" /> Adjust on the fly via AI Chat
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Feature 2: Kinetics (Alternating Layout) */}
      <section className="py-32 md:py-48 px-6 relative bg-secondary/20">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-32">
          <div className="flex-1 space-y-10 relative z-10">
            <h2 className="text-[10vw] md:text-[5.5vw] font-black font-display tracking-tight leading-[1.1]">
              Adaptive <br />
              <span className="text-primary italic font-light">workouts.</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
              Training routines that actually learn. Your plan adjusts every week based on your unique progress and feedback. It's a personal trainer that never sleeps.
            </p>
            <div className="pt-4">
              <Link to="/auth?mode=signup">
                <Button className="rounded-full h-14 px-10 text-base font-bold shadow-glow hover:scale-105 transition-transform">
                  Explore Kinetics
                </Button>
              </Link>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 w-full relative"
          >
            <div className="relative rounded-[2.5rem] glass-card overflow-hidden group border border-white/5 shadow-2xl transition-all hover:border-primary/20 bg-black/40">
              <img
                src="/images/push-day.png"
                alt="Workout Routine"
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2.5rem] pointer-events-none" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature 3: Deep Insights */}
      <section className="py-32 md:py-48 px-6 relative">
        <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-green-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center gap-16 md:gap-32">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex-1 w-full order-2 md:order-1 relative"
          >
            <div className="relative rounded-[2.5rem] glass-card overflow-visible group border border-white/5 shadow-2xl transition-all hover:border-primary/20 bg-black/40">
              <img
                src="/images/os-health.png"
                alt="OS Health Insights"
                className="w-full h-auto object-cover rounded-[2.5rem] transition-transform duration-700 group-hover:scale-[1.02]"
              />
              <motion.div
                initial={{ y: -30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="absolute top-[-10%] right-[-5%] md:right-[-10%] w-[50%] md:w-[60%] z-20 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/10"
              >
                <img src="/images/sync-buttons.png" alt="Sync Health Devices" className="w-full h-auto object-cover" />
              </motion.div>
            </div>
          </motion.div>

          <div className="flex-1 space-y-10 order-1 md:order-2 z-10">
            <h2 className="text-[10vw] md:text-[5.5vw] font-black font-display tracking-tight leading-[1.1]">
              Deep <br />
              <span className="text-primary italic font-light">Insights.</span>
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-lg">
              We sync directly with Apple Health and Android Health Connect to read your resting heart rate, sleep cycles, and caloric burn. The AI Engine correlates this data to proactively detect overtraining or metabolic crashes.
            </p>
            <ul className="space-y-4 pt-4">
              <li className="flex items-center gap-4 font-semibold text-lg text-foreground/90">
                <CheckCircle2 className="h-6 w-6 text-primary" /> Seamless OS Level Integration
              </li>
              <li className="flex items-center gap-4 font-semibold text-lg text-foreground/90">
                <CheckCircle2 className="h-6 w-6 text-primary" /> Proactive Fatigue Detection
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-32 md:py-48 bg-secondary/10 overflow-hidden">
        <div className="max-w-[1400px] mx-auto text-center mb-16 px-6">
          <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">Don't just take our word for it.</h2>
          <p className="text-muted-foreground text-xl">Real athletes, real results. Browse 30+ verified transformations.</p>
        </div>

        <div className="relative w-full overflow-hidden flex">
          {/* Fading Edges for Marquee */}
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <div className="flex w-max animate-marquee gap-8 md:gap-12 px-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="w-[350px] md:w-[450px] shrink-0 glass-card p-10 rounded-[2rem] border border-primary/10 hover:border-primary/30 hover:-translate-y-2 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-1 text-primary mb-8">
                    {[...Array(5)].map((_, idx) => <Star key={idx} className="h-5 w-5 fill-primary" />)}
                  </div>
                  <p className="text-xl md:text-2xl font-serif font-light leading-relaxed mb-10">"{t.quote}"</p>
                </div>
                <div className="mt-auto border-t border-border/50 pt-6">
                  <h4 className="font-bold text-lg mb-1">{t.author}</h4>
                  <p className="text-primary text-sm font-bold uppercase tracking-wider">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantee Section */}
      <section className="py-32 md:py-48 px-6 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pattern-dots pattern-black/5 pattern-bg-transparent pattern-size-4 opacity-50" />
        <div className="max-w-[1000px] mx-auto text-center relative z-10 flex flex-col items-center">
          <div className="h-28 w-28 rounded-full bg-black/10 flex items-center justify-center mb-10">
            <ShieldCheck className="h-14 w-14" />
          </div>
          <h2 className="text-[10vw] md:text-[6vw] font-black font-display tracking-tight leading-[1]">
            100% Results <br />
            <span className="font-light italic">Guaranteed.</span>
          </h2>
          <p className="text-xl md:text-3xl opacity-90 font-medium max-w-3xl mx-auto my-14 leading-relaxed">
            Follow the protocol for 30 days. Log your meals, hit your sessions. If you don't see measurable changes in your body, we will refund you entirely. No questions asked.
          </p>
          <Button variant="outline" className="rounded-full h-16 px-12 text-lg font-bold bg-transparent border-2 border-primary-foreground hover:bg-primary-foreground hover:text-primary transition-colors">
            Read the full guarantee
          </Button>
        </div>
      </section>

      {/* Massive Footer CTA */}
      <section className="min-h-[90vh] flex items-center justify-center relative px-6 py-32">
        <div className="relative z-10 text-center max-w-[1400px] mx-auto w-full">
          <h2 className="text-[9vw] md:text-[7vw] font-black font-display tracking-tight leading-[1.1] mb-20">
            Start Your <br /> <span className="text-primary italic font-light">Transformation</span>
          </h2>

          <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto text-left">
            {/* Free Tier */}
            <div className="border border-border/50 rounded-[2.5rem] p-12 bg-secondary/10 hover:bg-secondary/20 hover:border-white/20 transition-all duration-300 relative group flex flex-col">
              <div className="flex justify-between items-start mb-16">
                <div>
                  <h3 className="text-2xl font-bold tracking-wide text-muted-foreground mb-3">Basic</h3>
                  <p className="text-5xl font-display font-black">$0</p>
                </div>
                <ArrowUpRight className="h-10 w-10 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-lg text-muted-foreground mb-12 flex-grow">Access the foundation. Great for getting started on your journey.</p>
              <Link to="/auth?mode=signup" className="block w-full">
                <Button variant="outline" className="w-full rounded-full h-16 font-bold tracking-wide text-lg hover:bg-white hover:text-black hover:border-white transition-all">
                  Sign Up Free
                </Button>
              </Link>
            </div>

            {/* Pro Tier */}
            <div className="border border-primary rounded-[2.5rem] p-12 bg-primary/5 relative group overflow-hidden shadow-glow flex flex-col">
              <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
              <div className="flex justify-between items-start mb-16 relative z-10">
                <div>
                  <h3 className="text-2xl font-bold tracking-wide text-primary mb-3 flex items-center gap-2">
                    Pro Member <Sparkles className="h-5 w-5" />
                  </h3>
                  <p className="text-5xl font-display font-black text-foreground">$15<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
                </div>
                <Logo className="h-12 w-12 text-primary" />
              </div>
              <p className="text-lg text-muted-foreground mb-12 relative z-10 flex-grow">Unlimited AI coaching, premium meal access, and advanced biometric tracking to guarantee results.</p>
              <Link to="/auth?mode=signup" className="block w-full relative z-10">
                <Button className="w-full rounded-full h-16 font-bold tracking-wide text-lg bg-primary text-black hover:bg-primary/90 hover:scale-[1.02] shadow-xl transition-transform">
                  Upgrade to Pro
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Typographic Footer border */}
      <footer className="border-t border-border py-16 px-6 bg-secondary/10 relative z-10">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-sm text-muted-foreground font-medium">
          <div className="flex items-center gap-6">
            <Logo className="h-8 w-8 text-muted-foreground/50" />
            <span className="text-base tracking-widest uppercase font-bold text-muted-foreground/60">ai-shape</span>
          </div>
          <div className="flex gap-10 text-base">
            <Link to="/about" className="hover:text-primary transition-colors">About</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
