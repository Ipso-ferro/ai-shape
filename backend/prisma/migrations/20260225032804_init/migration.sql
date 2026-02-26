-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `subscriptionTier` ENUM('FREE', 'PRO') NOT NULL DEFAULT 'FREE',
    `isPro` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_profiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    `ageYrs` INTEGER NOT NULL,
    `heightCm` DOUBLE NOT NULL,
    `weightKg` DOUBLE NOT NULL,
    `targetWeightKg` DOUBLE NOT NULL,
    `goals` JSON NOT NULL,
    `workoutLocations` JSON NOT NULL,
    `diets` JSON NOT NULL,
    `allergies` JSON NOT NULL,
    `activityLevel` ENUM('SEDENTARY', 'LIGHTLY_ACTIVE', 'MODERATELY_ACTIVE', 'VERY_ACTIVE', 'ATHLETE') NOT NULL,
    `macroVelocity` ENUM('SLOW', 'AI_RECOMMENDED', 'FAST') NOT NULL DEFAULT 'AI_RECOMMENDED',
    `proteinG` INTEGER NOT NULL DEFAULT 0,
    `carbsG` INTEGER NOT NULL DEFAULT 0,
    `fatG` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tier` ENUM('FREE', 'PRO') NOT NULL DEFAULT 'FREE',
    `billingCycle` VARCHAR(191) NOT NULL,
    `stripeCustomerId` VARCHAR(191) NOT NULL DEFAULT '',
    `stripeSubscriptionId` VARCHAR(191) NOT NULL DEFAULT '',
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endsAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,

    UNIQUE INDEX `subscriptions_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workout_routines` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `weekday` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `durationMin` INTEGER NOT NULL DEFAULT 45,
    `intensity` ENUM('NONE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH') NOT NULL DEFAULT 'MEDIUM',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exercise_items` (
    `id` VARCHAR(191) NOT NULL,
    `routineId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sets` VARCHAR(191) NOT NULL,
    `notes` TEXT NOT NULL,
    `completed` BOOLEAN NOT NULL DEFAULT false,
    `orderIdx` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_meal_plans` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `totalCalories` INTEGER NOT NULL DEFAULT 0,
    `totalProteinG` DOUBLE NOT NULL DEFAULT 0,
    `totalCarbsG` DOUBLE NOT NULL DEFAULT 0,
    `totalFatG` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `daily_meal_plans_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meals` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `type` ENUM('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `scheduledHour` INTEGER NOT NULL DEFAULT 8,
    `calories` INTEGER NOT NULL,
    `proteinG` DOUBLE NOT NULL,
    `carbsG` DOUBLE NOT NULL,
    `fatG` DOUBLE NOT NULL,
    `ingredients` JSON NOT NULL,
    `instructions` JSON NOT NULL,
    `eaten` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `biometric_entries` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weightKg` DOUBLE NOT NULL,
    `bodyFatPct` DOUBLE NULL,
    `waistCm` DOUBLE NULL,
    `chestCm` DOUBLE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopping_items` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planDate` DATE NULL,
    `name` VARCHAR(191) NOT NULL,
    `qty` VARCHAR(191) NOT NULL,
    `category` ENUM('PROTEIN', 'CARBS', 'FATS', 'VEGGIES', 'DAIRY', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `checked` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invite_codes` (
    `id` VARCHAR(191) NOT NULL,
    `coachId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `usedByUserId` VARCHAR(191) NULL,
    `usedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invite_codes_code_key`(`code`),
    UNIQUE INDEX `invite_codes_usedByUserId_key`(`usedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_connections` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `connectedUserId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SYNCED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `sharedPlan` ENUM('MEAL', 'WORKOUT', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `streakDays` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_connections_userId_connectedUserId_key`(`userId`, `connectedUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workout_routines` ADD CONSTRAINT `workout_routines_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exercise_items` ADD CONSTRAINT `exercise_items_routineId_fkey` FOREIGN KEY (`routineId`) REFERENCES `workout_routines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_meal_plans` ADD CONSTRAINT `daily_meal_plans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meals` ADD CONSTRAINT `meals_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `daily_meal_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `biometric_entries` ADD CONSTRAINT `biometric_entries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shopping_items` ADD CONSTRAINT `shopping_items_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_codes` ADD CONSTRAINT `invite_codes_coachId_fkey` FOREIGN KEY (`coachId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_codes` ADD CONSTRAINT `invite_codes_usedByUserId_fkey` FOREIGN KEY (`usedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_connections` ADD CONSTRAINT `user_connections_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_connections` ADD CONSTRAINT `user_connections_connectedUserId_fkey` FOREIGN KEY (`connectedUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
