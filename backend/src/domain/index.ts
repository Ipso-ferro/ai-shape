// ─── Enums ────────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'FREE' | 'PRO';
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type WorkoutIntensity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'REJECTED';
export type SharedPlan = 'MEAL' | 'WORKOUT' | 'BOTH';
export type ShoppingCategory = 'PROTEIN' | 'CARBS' | 'FATS' | 'VEGGIES' | 'DAIRY' | 'OTHER';
export type AIChatContext = 'meal' | 'workout' | 'biometrics' | 'dashboard' | 'general';
export type ActivityLevel = 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'ATHLETE';
export type WorkoutLocation = 'GYM' | 'HOME' | 'CALISTHENICS';
export type MacroVelocity = 'SLOW' | 'AI_RECOMMENDED' | 'FAST';
export type Gender = 'MALE' | 'FEMALE';
export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

// ─── Entities ────────────────────────────────────────────────────────────────

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    subscriptionTier: SubscriptionTier;
    isPro: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface MacroTargets {
    proteinG: number;
    carbsG: number;
    fatG: number;
}

export interface UserProfile {
    id: string;
    userId: string;
    gender: Gender;
    ageYrs: number;
    heightCm: number;
    weightKg: number;
    targetWeightKg: number;
    goals: string[];
    workoutLocations: WorkoutLocation[];
    diets: string[];
    allergies: string[];
    activityLevel: ActivityLevel;
    macroVelocity: MacroVelocity;
    macroTargets: MacroTargets;
    updatedAt: Date;
}

export interface Subscription {
    id: string;
    userId: string;
    tier: SubscriptionTier;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    startedAt: Date;
    endsAt: Date | null;
    cancelledAt: Date | null;
}

export interface ExerciseItem {
    id: string;
    routineId: string;
    name: string;
    sets: string;
    notes: string;
    completed: boolean;
    orderIdx: number;
}

export interface WorkoutRoutine {
    id: string;
    userId: string;
    weekday: Weekday;
    name: string;
    durationMin: number;
    intensity: WorkoutIntensity;
    exercises: ExerciseItem[];
}

export interface Meal {
    id: string;
    planId: string;
    type: MealType;
    name: string;
    scheduledHour: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: string[];
    instructions: string[];
    eaten: boolean;
}

export interface DailyMealPlan {
    id: string;
    userId: string;
    date: Date;
    meals: Meal[];
    totalCalories: number;
    totalProteinG: number;
    totalCarbsG: number;
    totalFatG: number;
}

export interface BiometricEntry {
    id: string;
    userId: string;
    recordedAt: Date;
    weightKg: number;
    bodyFatPct: number | null;
    waistCm: number | null;
    chestCm: number | null;
}

export interface ShoppingItem {
    id: string;
    userId: string;
    name: string;
    qty: string;
    category: ShoppingCategory;
    checked: boolean;
}

export interface InviteCode {
    id: string;
    coachId: string;
    code: string;
    usedByUserId: string | null;
    usedAt: Date | null;
    expiresAt: Date;
}

export interface UserConnection {
    id: string;
    userId: string;
    connectedUserId: string;
    status: SyncStatus;
    sharedPlan: SharedPlan;
    streakDays: number;
    createdAt: Date;
}
