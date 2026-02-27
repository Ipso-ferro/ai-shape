import { prisma } from "../lib/prisma.js";

export async function ensureAppTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_users (
      id VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL,
      passwordHash VARCHAR(191) NOT NULL,
      isPro BOOLEAN NOT NULL DEFAULT false,
      subscriptionTier VARCHAR(191) NOT NULL DEFAULT 'FREE',
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE INDEX app_users_email_key(email)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_user_profiles (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      gender VARCHAR(191) NOT NULL,
      ageYrs INT NOT NULL,
      heightCm FLOAT NOT NULL,
      weightKg FLOAT NOT NULL,
      targetWeightKg FLOAT NOT NULL,
      goals JSON NOT NULL,
      workoutLocations JSON NOT NULL,
      diets JSON NOT NULL,
      allergies JSON NOT NULL,
      activityLevel VARCHAR(191) NOT NULL,
      mealsPerDay INT NOT NULL DEFAULT 3,
      macroVelocity VARCHAR(191) NOT NULL DEFAULT 'AI_RECOMMENDED',
      proteinG INT NOT NULL DEFAULT 0,
      carbsG INT NOT NULL DEFAULT 0,
      fatG INT NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE INDEX app_user_profiles_userId_key(userId),
      CONSTRAINT app_user_profiles_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_diet_plans (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      summary TEXT NOT NULL,
      planJson JSON NOT NULL,
      sourceMessage TEXT NOT NULL,
      mcpChanges JSON NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX app_diet_plans_userId_createdAt_idx(userId, createdAt),
      CONSTRAINT app_diet_plans_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_workout_plans (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      summary TEXT NOT NULL,
      planJson JSON NOT NULL,
      sourceMessage TEXT NOT NULL,
      mcpChanges JSON NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX app_workout_plans_userId_createdAt_idx(userId, createdAt),
      CONSTRAINT app_workout_plans_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_ai_messages (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      planType VARCHAR(191) NOT NULL,
      userMessage TEXT NOT NULL,
      aiResponseSummary TEXT NOT NULL,
      mcpChanges JSON NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      INDEX app_ai_messages_userId_planType_createdAt_idx(userId, planType, createdAt),
      CONSTRAINT app_ai_messages_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_meal_logs (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      date DATE NOT NULL,
      mealType VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      recipeId INT NULL,
      simpleFoodIds JSON NULL,
      calories FLOAT NOT NULL DEFAULT 0,
      proteinG FLOAT NOT NULL DEFAULT 0,
      carbsG FLOAT NOT NULL DEFAULT 0,
      fatG FLOAT NOT NULL DEFAULT 0,
      ingredients JSON NULL,
      instructions JSON NULL,
      eaten BOOLEAN NOT NULL DEFAULT false,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      INDEX app_meal_logs_userId_date_idx(userId, date),
      CONSTRAINT app_meal_logs_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_exercise_logs (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      date DATE NOT NULL,
      weekday VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      exerciseId INT NULL,
      sets VARCHAR(191) NULL,
      notes VARCHAR(191) NULL,
      durationMin INT NULL,
      intensity VARCHAR(191) NULL,
      completed BOOLEAN NOT NULL DEFAULT false,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      INDEX app_exercise_logs_userId_date_idx(userId, date),
      CONSTRAINT app_exercise_logs_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS app_shopping_items (
      id INT NOT NULL AUTO_INCREMENT,
      userId VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      qty VARCHAR(191) NOT NULL,
      category VARCHAR(191) NOT NULL,
      checked BOOLEAN NOT NULL DEFAULT false,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      INDEX app_shopping_items_userId_category_idx(userId, category),
      CONSTRAINT app_shopping_items_userId_fkey FOREIGN KEY (userId) REFERENCES app_users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}
