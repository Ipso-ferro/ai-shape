import { prisma } from '../database/prisma';
import type { Prisma } from '@prisma/client';

export const userRepository = {
    async findById(id: string) {
        return prisma.user.findUnique({ where: { id }, include: { profile: true, subscription: true } });
    },

    async findByEmail(email: string) {
        return prisma.user.findUnique({ where: { email }, include: { subscription: true } });
    },

    async create(data: { email: string; passwordHash: string }) {
        return prisma.user.create({ data });
    },

    async updatePro(id: string, isPro: boolean, tier: 'FREE' | 'PRO') {
        return prisma.user.update({
            where: { id },
            data: { isPro, subscriptionTier: tier },
        });
    },
};

export const userProfileRepository = {
    async findByUserId(userId: string) {
        return prisma.userProfile.findUnique({ where: { userId } });
    },

    async upsert(userId: string, data: Prisma.UserProfileUncheckedCreateInput) {
        return prisma.userProfile.upsert({
            where: { userId },
            create: data,
            update: { ...data, updatedAt: new Date() },
        });
    },
};

export const subscriptionRepository = {
    async findByUserId(userId: string) {
        return prisma.subscription.findUnique({ where: { userId } });
    },

    async upsert(userId: string, data: Prisma.SubscriptionUncheckedCreateInput) {
        return prisma.subscription.upsert({
            where: { userId },
            create: data,
            update: {
                tier: data.tier,
                billingCycle: data.billingCycle,
                stripeCustomerId: data.stripeCustomerId,
                stripeSubscriptionId: data.stripeSubscriptionId,
                startedAt: data.startedAt,
                endsAt: data.endsAt,
                cancelledAt: data.cancelledAt,
            },
        });
    },
};

export const biometricRepository = {
    async findByUserId(userId: string) {
        return prisma.biometricEntry.findMany({
            where: { userId },
            orderBy: { recordedAt: 'desc' },
        });
    },

    async create(data: Prisma.BiometricEntryUncheckedCreateInput) {
        return prisma.biometricEntry.create({ data });
    },
};

export const workoutRepository = {
    async findByUserId(userId: string) {
        return prisma.workoutRoutine.findMany({
            where: { userId },
            include: { exercises: { orderBy: { orderIdx: 'asc' } } },
            orderBy: { weekday: 'asc' },
        });
    },

    async upsertForWeekday(
        userId: string,
        weekday: string,
        data: {
            name: string;
            durationMin: number;
            intensity: string;
            exercises: { name: string; sets: string; notes: string; orderIdx: number }[];
        },
    ) {
        const existing = await prisma.workoutRoutine.findFirst({ where: { userId, weekday: weekday as any } });
        if (existing) {
            await prisma.exerciseItem.deleteMany({ where: { routineId: existing.id } });
            return prisma.workoutRoutine.update({
                where: { id: existing.id },
                data: {
                    name: data.name,
                    durationMin: data.durationMin,
                    intensity: data.intensity as any,
                    exercises: {
                        create: data.exercises,
                    },
                },
                include: { exercises: true },
            });
        }
        return prisma.workoutRoutine.create({
            data: {
                userId,
                weekday: weekday as any,
                name: data.name,
                durationMin: data.durationMin,
                intensity: data.intensity as any,
                exercises: { create: data.exercises },
            },
            include: { exercises: true },
        });
    },
};

export const mealPlanRepository = {
    async findByUserIdAndDate(userId: string, date: Date) {
        return prisma.dailyMealPlan.findUnique({
            where: { userId_date: { userId, date } },
            include: { meals: true },
        });
    },

    async findByUserId(userId: string) {
        return prisma.dailyMealPlan.findMany({
            where: { userId },
            include: { meals: true },
            orderBy: { date: 'desc' },
            take: 14,
        });
    },

    async create(data: {
        userId: string;
        date: Date;
        totalCalories: number;
        totalProteinG: number;
        totalCarbsG: number;
        totalFatG: number;
        meals: Prisma.MealUncheckedCreateWithoutPlanInput[];
    }) {
        return prisma.dailyMealPlan.create({
            data: {
                userId: data.userId,
                date: data.date,
                totalCalories: data.totalCalories,
                totalProteinG: data.totalProteinG,
                totalCarbsG: data.totalCarbsG,
                totalFatG: data.totalFatG,
                meals: { create: data.meals },
            },
            include: { meals: true },
        });
    },

    async upsertForDate(userId: string, date: Date, data: {
        totalCalories: number;
        totalProteinG: number;
        totalCarbsG: number;
        totalFatG: number;
        meals: Prisma.MealUncheckedCreateWithoutPlanInput[];
    }) {
        // Delete existing plan for this date if any
        const existing = await prisma.dailyMealPlan.findUnique({
            where: { userId_date: { userId, date } },
        });
        if (existing) {
            await prisma.meal.deleteMany({ where: { planId: existing.id } });
            await prisma.dailyMealPlan.delete({ where: { id: existing.id } });
        }
        return prisma.dailyMealPlan.create({
            data: {
                userId,
                date,
                totalCalories: data.totalCalories,
                totalProteinG: data.totalProteinG,
                totalCarbsG: data.totalCarbsG,
                totalFatG: data.totalFatG,
                meals: { create: data.meals },
            },
            include: { meals: true },
        });
    },
};

export const weeklyMealPlanRepository = {
    async findByUserId(userId: string) {
        return prisma.weeklyMealPlan.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    },

    async create(userId: string, weeklyMeals: any, weeklyIngredients: any) {
        return prisma.weeklyMealPlan.create({
            data: {
                userId,
                weeklyMeals,
                weeklyIngredients,
            },
        });
    },
};

export const shoppingRepository = {
    async findByUserId(userId: string) {
        return prisma.shoppingItem.findMany({ where: { userId }, orderBy: { category: 'asc' } });
    },

    async createMany(items: Prisma.ShoppingItemUncheckedCreateInput[]) {
        return prisma.shoppingItem.createMany({ data: items });
    },

    async deleteManyByUserId(userId: string) {
        return prisma.shoppingItem.deleteMany({ where: { userId } });
    },

    async toggleChecked(id: string, checked: boolean) {
        return prisma.shoppingItem.update({ where: { id }, data: { checked } });
    },
};

export const inviteCodeRepository = {
    async findByCoachId(coachId: string) {
        return prisma.inviteCode.findMany({ where: { coachId }, orderBy: { expiresAt: 'desc' } });
    },

    async findByCode(code: string) {
        return prisma.inviteCode.findUnique({ where: { code } });
    },

    async create(data: Prisma.InviteCodeUncheckedCreateInput) {
        return prisma.inviteCode.create({ data });
    },

    async redeem(id: string, userId: string) {
        return prisma.inviteCode.update({
            where: { id },
            data: { usedByUserId: userId, usedAt: new Date() },
        });
    },
};

export const connectionRepository = {
    async findByUserId(userId: string) {
        return prisma.userConnection.findMany({
            where: { userId },
            include: { connectedUser: { select: { id: true, email: true } } },
        });
    },

    async create(userId: string, connectedUserId: string) {
        return prisma.userConnection.create({ data: { userId, connectedUserId } });
    },

    async updateStatus(id: string, status: 'PENDING' | 'SYNCED' | 'REJECTED') {
        return prisma.userConnection.update({ where: { id }, data: { status } });
    },
};
