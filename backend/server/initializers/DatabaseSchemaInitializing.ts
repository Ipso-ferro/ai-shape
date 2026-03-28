import { Pool, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../pool";

const createDietStorageTableStatement = (tableName: string): string => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
    summary JSON NULL,
    day_number TINYINT UNSIGNED NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    breakfast JSON NOT NULL,
    snack_1 JSON NOT NULL,
    lunch JSON NOT NULL,
    dinner JSON NOT NULL,
    snack_2 JSON NOT NULL,
    supplements JSON NOT NULL,
    breakfast_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    snack_1_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    lunch_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    dinner_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    snack_2_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    supplements_eaten BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, plan_week, day_number),
    UNIQUE KEY uk_${tableName}_id (id),
    KEY idx_${tableName}_week (user_id, plan_week),
    CONSTRAINT fk_${tableName}_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createWorkoutPlanDaysTableStatement = `
  CREATE TABLE IF NOT EXISTS user_workout_plan_days (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
    overview JSON NULL,
    day_number TINYINT UNSIGNED NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    focus VARCHAR(255) NOT NULL,
    warm_up JSON NOT NULL,
    exercises JSON NOT NULL,
    cool_down JSON NOT NULL,
    total_duration VARCHAR(50) NOT NULL,
    estimated_calories_burned INT UNSIGNED NOT NULL DEFAULT 0,
    estimated_kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0,
    complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, plan_week, day_number),
    UNIQUE KEY uk_user_workout_plan_days_id (id),
    KEY idx_user_workout_plan_days_week (user_id, plan_week),
    CONSTRAINT fk_user_workout_plan_days_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserProgressTrackingTableStatement = `
  CREATE TABLE IF NOT EXISTS user_progress_tracking (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    tracked_on DATE NOT NULL,
    plan_day_number TINYINT UNSIGNED NOT NULL,
    plan_day_name VARCHAR(20) NOT NULL,
    target_calories INT UNSIGNED NOT NULL DEFAULT 0,
    target_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    breakfast_completed_at DATETIME DEFAULT NULL,
    breakfast_calories INT UNSIGNED NOT NULL DEFAULT 0,
    breakfast_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    snack_1_completed_at DATETIME DEFAULT NULL,
    snack_1_calories INT UNSIGNED NOT NULL DEFAULT 0,
    snack_1_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    lunch_completed_at DATETIME DEFAULT NULL,
    lunch_calories INT UNSIGNED NOT NULL DEFAULT 0,
    lunch_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    dinner_completed_at DATETIME DEFAULT NULL,
    dinner_calories INT UNSIGNED NOT NULL DEFAULT 0,
    dinner_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    snack_2_completed_at DATETIME DEFAULT NULL,
    snack_2_calories INT UNSIGNED NOT NULL DEFAULT 0,
    snack_2_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    supplements_completed_at DATETIME DEFAULT NULL,
    supplements_calories INT UNSIGNED NOT NULL DEFAULT 0,
    supplements_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    workout_completed_at DATETIME DEFAULT NULL,
    workout_calories_burned INT UNSIGNED NOT NULL DEFAULT 0,
    workout_kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0,
    total_calories_consumed INT UNSIGNED NOT NULL DEFAULT 0,
    total_kilojoules_consumed INT UNSIGNED NOT NULL DEFAULT 0,
    total_calories_burned INT UNSIGNED NOT NULL DEFAULT 0,
    total_kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0,
    net_calories INT NOT NULL DEFAULT 0,
    net_kilojoules INT NOT NULL DEFAULT 0,
    calorie_delta_from_target INT NOT NULL DEFAULT 0,
    kilojoule_delta_from_target INT NOT NULL DEFAULT 0,
    meals_completed_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    workouts_completed_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tracked_on),
    UNIQUE KEY uk_user_progress_tracking_id (id),
    CONSTRAINT fk_user_progress_tracking_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserTrackingTableStatement = (tableName = "user_tracking"): string => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    user_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    kjs_consumed INT UNSIGNED NOT NULL DEFAULT 0,
    macros_consumed JSON NOT NULL,
    kjs_target INT UNSIGNED NOT NULL DEFAULT 0,
    macros_target JSON NOT NULL,
    kjs_burned INT UNSIGNED NOT NULL DEFAULT 0,
    kjs_burned_target INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date),
    CONSTRAINT fk_${tableName}_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserExerciseLogsTableStatement = `
  CREATE TABLE IF NOT EXISTS user_exercise_logs (
    user_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    exercise_name VARCHAR(255) NOT NULL,
    sets_completed INT UNSIGNED NOT NULL DEFAULT 0,
    reps_completed INT UNSIGNED NOT NULL DEFAULT 0,
    weight_used DECIMAL(10,2) NOT NULL DEFAULT 0,
    volume DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date, exercise_name),
    CONSTRAINT fk_user_exercise_logs_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserWaterTableStatement = `
  CREATE TABLE IF NOT EXISTS user_water (
    user_id CHAR(36) NOT NULL,
    date DATE NOT NULL,
    target_liters DECIMAL(4,1) NOT NULL DEFAULT 0,
    target_glasses TINYINT UNSIGNED NOT NULL DEFAULT 0,
    glasses_completed TINYINT UNSIGNED NOT NULL DEFAULT 0,
    liters_per_glass DECIMAL(3,1) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, date),
    CONSTRAINT fk_user_water_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserTrackingHistoryTableStatement = `
  CREATE TABLE IF NOT EXISTS user_tracking_history (
    user_id CHAR(36) NOT NULL,
    tracked_on DATE NOT NULL,
    kilojoules_consumed INT UNSIGNED NOT NULL DEFAULT 0,
    kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tracked_on),
    CONSTRAINT fk_user_tracking_history_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createShoppingListTableStatement = (tableName: string): string => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
    days_covered TINYINT UNSIGNED NOT NULL DEFAULT 7,
    shopping_list JSON NOT NULL,
    checked_items JSON DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, plan_week),
    UNIQUE KEY uk_${tableName}_id (id),
    KEY idx_${tableName}_week (user_id, plan_week),
    CONSTRAINT fk_${tableName}_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const tableExists = async (pool: Pool, tableName: string): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName],
  );

  return rows.length > 0;
};

const columnExists = async (
  pool: Pool,
  tableName: string,
  columnName: string,
): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows.length > 0;
};

const indexExists = async (
  pool: Pool,
  tableName: string,
  indexName: string,
): Promise<boolean> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [tableName, indexName],
  );

  return rows.length > 0;
};

const ensureJsonColumn = async (
  pool: Pool,
  columnName: string,
  afterColumn: string,
): Promise<void> => {
  if (await columnExists(pool, "users", columnName)) {
    return;
  }

  await pool.query(
    `
      ALTER TABLE users
      ADD COLUMN ${columnName} JSON NULL AFTER ${afterColumn}
    `,
  );
};

const ensureVarcharColumn = async (
  pool: Pool,
  tableName: string,
  columnName: string,
  definition: string,
  afterColumn: string,
): Promise<void> => {
  if (await columnExists(pool, tableName, columnName)) {
    return;
  }

  await pool.query(
    `
      ALTER TABLE ${tableName}
      ADD COLUMN ${columnName} ${definition} AFTER ${afterColumn}
    `,
  );
};

const ensureDecimalColumn = async (
  pool: Pool,
  tableName: string,
  columnName: string,
  definition: string,
  afterColumn: string,
): Promise<void> => {
  if (await columnExists(pool, tableName, columnName)) {
    return;
  }

  await pool.query(
    `
      ALTER TABLE ${tableName}
      ADD COLUMN ${columnName} ${definition} AFTER ${afterColumn}
    `,
  );
};

const ensureBooleanColumn = async (
  pool: Pool,
  tableName: string,
  columnName: string,
  afterColumn: string,
): Promise<void> => {
  if (await columnExists(pool, tableName, columnName)) {
    return;
  }

  await pool.query(
    `
      ALTER TABLE ${tableName}
      ADD COLUMN ${columnName} BOOLEAN NOT NULL DEFAULT FALSE AFTER ${afterColumn}
    `,
  );
};

const dropColumnIfExists = async (
  pool: Pool,
  tableName: string,
  columnName: string,
): Promise<void> => {
  if (!await columnExists(pool, tableName, columnName)) {
    return;
  }

  await pool.query(
    `
      ALTER TABLE ${tableName}
      DROP COLUMN ${columnName}
    `,
  );
};

const ensureStableIdColumn = async (
  pool: Pool,
  tableName: string,
  uniqueIndexName: string,
): Promise<void> => {
  if (!await columnExists(pool, tableName, "id")) {
    await pool.query(
      `
        ALTER TABLE ${tableName}
        ADD COLUMN id CHAR(36) NULL FIRST
      `,
    );
  }

  await pool.query(
    `
      UPDATE ${tableName}
      SET id = UUID()
      WHERE id IS NULL OR TRIM(id) = ''
    `,
  );

  await pool.query(
    `
      ALTER TABLE ${tableName}
      MODIFY COLUMN id CHAR(36) NOT NULL
    `,
  );

  if (!await indexExists(pool, tableName, uniqueIndexName)) {
    await pool.query(
      `
        CREATE UNIQUE INDEX ${uniqueIndexName}
        ON ${tableName} (id)
      `,
    );
  }
};

const ensureGoogleIdentityColumns = async (pool: Pool): Promise<void> => {
  await ensureVarcharColumn(pool, "users", "google_sub", "VARCHAR(255) NULL", "password");

  if (!await indexExists(pool, "users", "uk_users_google_sub")) {
    await pool.query(
      `
        CREATE UNIQUE INDEX uk_users_google_sub
        ON users (google_sub)
      `,
    );
  }
};

const ensureEnergyUnitPreferenceColumn = async (pool: Pool): Promise<void> => {
  await ensureVarcharColumn(
    pool,
    "users",
    "energy_unit_preference",
    "VARCHAR(10) NOT NULL DEFAULT 'kj'",
    "kind_of_diet",
  );
};

const ensureTargetWeightColumn = async (pool: Pool): Promise<void> => {
  await ensureDecimalColumn(pool, "users", "target_weight", "DECIMAL(6,2) NULL", "weight");
};

const ensureCheatWeeklyMealColumn = async (pool: Pool): Promise<void> => {
  await ensureBooleanColumn(pool, "users", "cheat_weekly_meal", "kind_of_diet");
};

const ensureWorkoutDayMetricColumns = async (pool: Pool): Promise<void> => {
  if (!await tableExists(pool, "user_workout_plan_days")) {
    return;
  }

  if (!await columnExists(pool, "user_workout_plan_days", "estimated_calories_burned")) {
    await pool.query(
      `
        ALTER TABLE user_workout_plan_days
        ADD COLUMN estimated_calories_burned INT UNSIGNED NOT NULL DEFAULT 0 AFTER total_duration
      `,
    );
  }

  if (!await columnExists(pool, "user_workout_plan_days", "estimated_kilojoules_burned")) {
    await pool.query(
      `
        ALTER TABLE user_workout_plan_days
        ADD COLUMN estimated_kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0 AFTER estimated_calories_burned
      `,
    );
  }
};

const ensurePlanRowStateColumns = async (pool: Pool): Promise<void> => {
  const dietTables = [
    "user_diet_plan",
    "user_recipe_plan",
  ] as const;

  for (const tableName of dietTables) {
    if (!await tableExists(pool, tableName)) {
      continue;
    }

    await ensureStableIdColumn(pool, tableName, `uk_${tableName}_id`);
    await ensureBooleanColumn(pool, tableName, "breakfast_eaten", "supplements");
    await ensureBooleanColumn(pool, tableName, "snack_1_eaten", "breakfast_eaten");
    await ensureBooleanColumn(pool, tableName, "lunch_eaten", "snack_1_eaten");
    await ensureBooleanColumn(pool, tableName, "dinner_eaten", "lunch_eaten");
    await ensureBooleanColumn(pool, tableName, "snack_2_eaten", "dinner_eaten");
    await ensureBooleanColumn(pool, tableName, "supplements_eaten", "snack_2_eaten");
    await dropColumnIfExists(pool, tableName, "eaten");
  }

  if (await tableExists(pool, "user_workout_plan_days")) {
    await ensureStableIdColumn(pool, "user_workout_plan_days", "uk_user_workout_plan_days_id");
    await ensureBooleanColumn(pool, "user_workout_plan_days", "complete", "estimated_kilojoules_burned");
  }

  const shoppingTables = [
    "shopping_market_single_food_list",
    "shopping_market_recipes_list",
  ] as const;

  for (const tableName of shoppingTables) {
    if (!await tableExists(pool, tableName)) {
      continue;
    }

    await ensureStableIdColumn(pool, tableName, `uk_${tableName}_id`);
  }

  if (await tableExists(pool, "user_progress_tracking")) {
    await ensureStableIdColumn(pool, "user_progress_tracking", "uk_user_progress_tracking_id");
  }
};

const migrateLegacyPlanSummaries = async (pool: Pool): Promise<void> => {
  if (await tableExists(pool, "user_diet_plans")) {
    await pool.query(
      `
        UPDATE users AS users_table
        INNER JOIN user_diet_plans AS legacy_diet_plans
          ON users_table.id = legacy_diet_plans.user_id
        SET users_table.diet_plan_summary = COALESCE(
          users_table.diet_plan_summary,
          legacy_diet_plans.summary
        )
      `,
    );
  }

  if (await tableExists(pool, "user_workout_plans")) {
    await pool.query(
      `
        UPDATE users AS users_table
        INNER JOIN user_workout_plans AS legacy_workout_plans
          ON users_table.id = legacy_workout_plans.user_id
        SET users_table.workout_plan_overview = COALESCE(
          users_table.workout_plan_overview,
          legacy_workout_plans.overview
        )
      `,
    );
  }
};

const migrateLegacyDietDays = async (pool: Pool): Promise<void> => {
  const recipeTableExists = await tableExists(pool, "user_recipe_plan");
  const dietTableExists = await tableExists(pool, "user_diet_plan");
  const recipeTableHasPlanWeek = recipeTableExists
    && await columnExists(pool, "user_recipe_plan", "plan_week");
  const recipeTableHasSummary = recipeTableExists
    && await columnExists(pool, "user_recipe_plan", "summary");
  const dietTableHasPlanWeek = dietTableExists
    && await columnExists(pool, "user_diet_plan", "plan_week");
  const dietTableHasSummary = dietTableExists
    && await columnExists(pool, "user_diet_plan", "summary");
  const recipeTableUpgraded = recipeTableExists
    && recipeTableHasPlanWeek
    && recipeTableHasSummary;
  const dietTableUpgraded = dietTableExists
    && dietTableHasPlanWeek
    && dietTableHasSummary;

  if (recipeTableUpgraded && dietTableUpgraded) {
    return;
  }

  if (recipeTableExists) {
    if (!dietTableExists) {
      await pool.query(createDietStorageTableStatement("user_diet_plan"));
    } else if (!dietTableUpgraded) {
      await pool.query("DROP TABLE IF EXISTS user_diet_plan_tmp");
      await pool.query(createDietStorageTableStatement("user_diet_plan_tmp"));
      await pool.query(
        `
          INSERT INTO user_diet_plan_tmp (
            id,
            user_id,
            plan_week,
            summary,
            day_number,
            day_name,
            breakfast,
            snack_1,
            lunch,
            dinner,
            snack_2,
            supplements,
            breakfast_eaten,
            snack_1_eaten,
            lunch_eaten,
            dinner_eaten,
            snack_2_eaten,
            supplements_eaten
          )
          SELECT
            UUID(),
            legacy_diet_days.user_id,
            ${dietTableHasPlanWeek ? "legacy_diet_days.plan_week" : "'current'"},
            ${dietTableHasSummary ? "COALESCE(legacy_diet_days.summary, users_table.diet_plan_summary)" : "users_table.diet_plan_summary"},
            legacy_diet_days.day_number,
            legacy_diet_days.day_name,
            legacy_diet_days.breakfast,
            legacy_diet_days.snack_1,
            legacy_diet_days.lunch,
            legacy_diet_days.dinner,
            legacy_diet_days.snack_2,
            legacy_diet_days.supplements,
            FALSE,
            FALSE,
            FALSE,
            FALSE,
            FALSE,
            FALSE
          FROM user_diet_plan AS legacy_diet_days
          LEFT JOIN users AS users_table
            ON users_table.id = legacy_diet_days.user_id
        `,
      );
      await pool.query("DROP TABLE user_diet_plan");
      await pool.query("RENAME TABLE user_diet_plan_tmp TO user_diet_plan");
    }

    if (!recipeTableUpgraded) {
      await pool.query("DROP TABLE IF EXISTS user_recipe_plan_tmp");
      await pool.query(createDietStorageTableStatement("user_recipe_plan_tmp"));
      await pool.query(
        `
          INSERT INTO user_recipe_plan_tmp (
            id,
            user_id,
            plan_week,
            summary,
            day_number,
            day_name,
            breakfast,
            snack_1,
            lunch,
            dinner,
            snack_2,
            supplements,
            breakfast_eaten,
            snack_1_eaten,
            lunch_eaten,
            dinner_eaten,
            snack_2_eaten,
            supplements_eaten
          )
          SELECT
            UUID(),
            legacy_recipe_days.user_id,
            ${recipeTableHasPlanWeek ? "legacy_recipe_days.plan_week" : "'current'"},
            ${recipeTableHasSummary ? "COALESCE(legacy_recipe_days.summary, users_table.diet_plan_summary)" : "users_table.diet_plan_summary"},
            legacy_recipe_days.day_number,
            legacy_recipe_days.day_name,
            legacy_recipe_days.breakfast,
            legacy_recipe_days.snack_1,
            legacy_recipe_days.lunch,
            legacy_recipe_days.dinner,
            legacy_recipe_days.snack_2,
            legacy_recipe_days.supplements,
            FALSE,
            FALSE,
            FALSE,
            FALSE,
            FALSE,
            FALSE
          FROM user_recipe_plan AS legacy_recipe_days
          LEFT JOIN users AS users_table
            ON users_table.id = legacy_recipe_days.user_id
        `,
      );
      await pool.query("DROP TABLE user_recipe_plan");
      await pool.query("RENAME TABLE user_recipe_plan_tmp TO user_recipe_plan");
    }

    return;
  }

  if (!dietTableExists) {
    await pool.query(createDietStorageTableStatement("user_diet_plan"));
    await pool.query(createDietStorageTableStatement("user_recipe_plan"));
    return;
  }

  await pool.query("DROP TABLE IF EXISTS user_diet_plan_tmp");
  await pool.query("DROP TABLE IF EXISTS user_recipe_plan_tmp");

  await pool.query(createDietStorageTableStatement("user_diet_plan_tmp"));
  await pool.query(createDietStorageTableStatement("user_recipe_plan_tmp"));

  await pool.query(
    `
      INSERT INTO user_diet_plan_tmp (
        id,
        user_id,
        plan_week,
        summary,
        day_number,
        day_name,
        breakfast,
        snack_1,
        lunch,
        dinner,
        snack_2,
        supplements,
        breakfast_eaten,
        snack_1_eaten,
        lunch_eaten,
        dinner_eaten,
        snack_2_eaten,
        supplements_eaten
      )
      SELECT
        UUID(),
        legacy_diet_days.user_id,
        ${dietTableHasPlanWeek ? "legacy_diet_days.plan_week" : "'current'"},
        ${dietTableHasSummary ? "COALESCE(legacy_diet_days.summary, users_table.diet_plan_summary)" : "users_table.diet_plan_summary"},
        legacy_diet_days.day_number,
        legacy_diet_days.day_name,
        legacy_diet_days.breakfast,
        legacy_diet_days.snack_1,
        legacy_diet_days.lunch,
        legacy_diet_days.dinner,
        legacy_diet_days.snack_2,
        legacy_diet_days.supplements,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE
      FROM user_diet_plan AS legacy_diet_days
      LEFT JOIN users AS users_table
        ON users_table.id = legacy_diet_days.user_id
      WHERE COALESCE(
        users_table.kind_of_diet,
        JSON_UNQUOTE(JSON_EXTRACT(users_table.diet_plan_summary, '$.dietType')),
        'single-food'
      ) <> 'recipes'
    `,
  );

  await pool.query(
    `
      INSERT INTO user_recipe_plan_tmp (
        id,
        user_id,
        plan_week,
        summary,
        day_number,
        day_name,
        breakfast,
        snack_1,
        lunch,
        dinner,
        snack_2,
        supplements,
        breakfast_eaten,
        snack_1_eaten,
        lunch_eaten,
        dinner_eaten,
        snack_2_eaten,
        supplements_eaten
      )
      SELECT
        UUID(),
        legacy_diet_days.user_id,
        ${dietTableHasPlanWeek ? "legacy_diet_days.plan_week" : "'current'"},
        ${dietTableHasSummary ? "COALESCE(legacy_diet_days.summary, users_table.diet_plan_summary)" : "users_table.diet_plan_summary"},
        legacy_diet_days.day_number,
        legacy_diet_days.day_name,
        legacy_diet_days.breakfast,
        legacy_diet_days.snack_1,
        legacy_diet_days.lunch,
        legacy_diet_days.dinner,
        legacy_diet_days.snack_2,
        legacy_diet_days.supplements,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE,
        FALSE
      FROM user_diet_plan AS legacy_diet_days
      INNER JOIN users AS users_table
        ON users_table.id = legacy_diet_days.user_id
      WHERE COALESCE(
        users_table.kind_of_diet,
        JSON_UNQUOTE(JSON_EXTRACT(users_table.diet_plan_summary, '$.dietType')),
        'single-food'
      ) = 'recipes'
    `,
  );

  await pool.query("DROP TABLE user_diet_plan");
  await pool.query("RENAME TABLE user_diet_plan_tmp TO user_diet_plan");
  await pool.query("RENAME TABLE user_recipe_plan_tmp TO user_recipe_plan");
};

const migrateLegacyWorkoutDays = async (pool: Pool): Promise<void> => {
  const legacyWorkoutHeaderExists = await tableExists(pool, "user_workout_plans");
  const workoutDaysExists = await tableExists(pool, "user_workout_plan_days");
  const workoutPlanWeekExists = workoutDaysExists
    ? await columnExists(pool, "user_workout_plan_days", "plan_week")
    : false;
  const workoutOverviewExists = workoutDaysExists
    ? await columnExists(pool, "user_workout_plan_days", "overview")
    : false;

  if (!legacyWorkoutHeaderExists && workoutDaysExists && workoutPlanWeekExists && workoutOverviewExists) {
    return;
  }

  if (!legacyWorkoutHeaderExists && !workoutDaysExists) {
    await pool.query(createWorkoutPlanDaysTableStatement);
    return;
  }

  if (!workoutDaysExists) {
    await pool.query(createWorkoutPlanDaysTableStatement);
    return;
  }

  await pool.query("DROP TABLE IF EXISTS user_workout_plan_days_tmp");
  await pool.query(
    createWorkoutPlanDaysTableStatement.replace(
      "user_workout_plan_days",
      "user_workout_plan_days_tmp",
    ).replace(
      "fk_user_workout_plan_days_user",
      "fk_user_workout_plan_days_tmp_user",
    ),
  );

  await pool.query(
    `
      INSERT INTO user_workout_plan_days_tmp (
        id,
        user_id,
        plan_week,
        overview,
        day_number,
        day_name,
        focus,
        warm_up,
        exercises,
        cool_down,
        total_duration,
        complete
      )
      SELECT
        UUID(),
        workout_days.user_id,
        'current',
        users_table.workout_plan_overview,
        workout_days.day_number,
        workout_days.day_name,
        workout_days.focus,
        workout_days.warm_up,
        workout_days.exercises,
        workout_days.cool_down,
        workout_days.total_duration,
        FALSE
      FROM user_workout_plan_days AS workout_days
      INNER JOIN users AS users_table
        ON users_table.id = workout_days.user_id
    `,
  );

  await pool.query("DROP TABLE user_workout_plan_days");
  await pool.query("RENAME TABLE user_workout_plan_days_tmp TO user_workout_plan_days");
};

const migrateUserTrackingTable = async (pool: Pool): Promise<void> => {
  if (!await tableExists(pool, "user_tracking")) {
    return;
  }

  if (await columnExists(pool, "user_tracking", "kjs_consumed")) {
    return;
  }

  await pool.query("DROP TABLE IF EXISTS user_tracking_tmp");
  await pool.query(createUserTrackingTableStatement("user_tracking_tmp"));

  await pool.query(
    `
      INSERT INTO user_tracking_tmp (
        user_id,
        date,
        kjs_consumed,
        macros_consumed,
        kjs_target,
        macros_target,
        kjs_burned,
        kjs_burned_target
      )
      SELECT
        user_id,
        tracked_on,
        daily_kilojoules_consumed,
        JSON_OBJECT(
          'proteinGrams', COALESCE(protein_grams, 0),
          'carbsGrams', COALESCE(carbs_grams, 0),
          'fatsGrams', COALESCE(fats_grams, 0)
        ),
        target_kilojoules,
        JSON_OBJECT(
          'proteinGrams', 0,
          'carbsGrams', 0,
          'fatsGrams', 0
        ),
        daily_kilojoules_burned,
        0
      FROM user_tracking
    `,
  );

  await pool.query("DROP TABLE user_tracking");
  await pool.query("RENAME TABLE user_tracking_tmp TO user_tracking");
};

const dropLegacyHeaderTables = async (pool: Pool): Promise<void> => {
  if (await tableExists(pool, "user_diet_plans")) {
    await pool.query("DROP TABLE user_diet_plans");
  }

  if (await tableExists(pool, "user_workout_plans")) {
    await pool.query("DROP TABLE user_workout_plans");
  }
};

const migrateLegacyShoppingLists = async (pool: Pool): Promise<void> => {
  const singleFoodTableName = "shopping_market_single_food_list";
  const recipeTableName = "shopping_market_recipes_list";
  const singleFoodTableExists = await tableExists(pool, singleFoodTableName);
  const recipeTableExists = await tableExists(pool, recipeTableName);
  const singleFoodTableUpgraded = singleFoodTableExists
    && await columnExists(pool, singleFoodTableName, "plan_week");
  const recipeTableUpgraded = recipeTableExists
    && await columnExists(pool, recipeTableName, "plan_week");

  if (!singleFoodTableExists) {
    await pool.query(createShoppingListTableStatement(singleFoodTableName));
  } else if (!singleFoodTableUpgraded) {
    await pool.query("DROP TABLE IF EXISTS shopping_market_single_food_list_tmp");
    await pool.query(createShoppingListTableStatement("shopping_market_single_food_list_tmp"));
    await pool.query(
      `
        INSERT INTO shopping_market_single_food_list_tmp (
          id,
          user_id,
          plan_week,
          days_covered,
          shopping_list,
          checked_items
        )
        SELECT
          UUID(),
          user_id,
          'current',
          days_covered,
          shopping_list,
          checked_items
        FROM shopping_market_single_food_list
      `,
    );
    await pool.query("DROP TABLE shopping_market_single_food_list");
    await pool.query(
      "RENAME TABLE shopping_market_single_food_list_tmp TO shopping_market_single_food_list",
    );
  }

  if (!recipeTableExists) {
    await pool.query(createShoppingListTableStatement(recipeTableName));
  } else if (!recipeTableUpgraded) {
    await pool.query("DROP TABLE IF EXISTS shopping_market_recipes_list_tmp");
    await pool.query(createShoppingListTableStatement("shopping_market_recipes_list_tmp"));
    await pool.query(
      `
        INSERT INTO shopping_market_recipes_list_tmp (
          id,
          user_id,
          plan_week,
          days_covered,
          shopping_list,
          checked_items
        )
        SELECT
          UUID(),
          user_id,
          'current',
          days_covered,
          shopping_list,
          checked_items
        FROM shopping_market_recipes_list
      `,
    );
    await pool.query("DROP TABLE shopping_market_recipes_list");
    await pool.query(
      "RENAME TABLE shopping_market_recipes_list_tmp TO shopping_market_recipes_list",
    );
  }

  if (!await tableExists(pool, "user_shopping_list")) {
    return;
  }

  await pool.query(
    `
      INSERT INTO shopping_market_single_food_list (
        id,
        user_id,
        plan_week,
        days_covered,
        shopping_list,
        checked_items
      )
      SELECT
        UUID(),
        legacy_shopping_list.user_id,
        'current',
        legacy_shopping_list.days_covered,
        legacy_shopping_list.shopping_list,
        legacy_shopping_list.checked_items
      FROM user_shopping_list AS legacy_shopping_list
      LEFT JOIN users AS users_table
        ON users_table.id = legacy_shopping_list.user_id
      WHERE COALESCE(
        users_table.kind_of_diet,
        JSON_UNQUOTE(JSON_EXTRACT(users_table.diet_plan_summary, '$.dietType')),
        'single-food'
      ) <> 'recipes'
      ON DUPLICATE KEY UPDATE
        days_covered = VALUES(days_covered),
        shopping_list = VALUES(shopping_list),
        checked_items = VALUES(checked_items)
    `,
  );

  await pool.query(
    `
      INSERT INTO shopping_market_recipes_list (
        id,
        user_id,
        plan_week,
        days_covered,
        shopping_list,
        checked_items
      )
      SELECT
        UUID(),
        legacy_shopping_list.user_id,
        'current',
        legacy_shopping_list.days_covered,
        legacy_shopping_list.shopping_list,
        legacy_shopping_list.checked_items
      FROM user_shopping_list AS legacy_shopping_list
      INNER JOIN users AS users_table
        ON users_table.id = legacy_shopping_list.user_id
      WHERE COALESCE(
        users_table.kind_of_diet,
        JSON_UNQUOTE(JSON_EXTRACT(users_table.diet_plan_summary, '$.dietType')),
        'single-food'
      ) = 'recipes'
      ON DUPLICATE KEY UPDATE
        days_covered = VALUES(days_covered),
        shopping_list = VALUES(shopping_list),
        checked_items = VALUES(checked_items)
    `,
  );

  await pool.query("DROP TABLE user_shopping_list");
};

export const initializeDatabaseSchema = async (
  pool: Pool = mysqlPool,
): Promise<void> => {
  await ensureGoogleIdentityColumns(pool);
  await ensureEnergyUnitPreferenceColumn(pool);
  await ensureTargetWeightColumn(pool);
  await ensureCheatWeeklyMealColumn(pool);
  await ensureJsonColumn(pool, "supplementation", "favorite_foods");
  await ensureJsonColumn(pool, "diet_plan_summary", "kind_of_diet");
  await ensureJsonColumn(pool, "workout_plan_overview", "diet_plan_summary");

  await migrateLegacyPlanSummaries(pool);
  await migrateLegacyDietDays(pool);
  await migrateLegacyWorkoutDays(pool);
  await migrateUserTrackingTable(pool);
  await ensureWorkoutDayMetricColumns(pool);
  await dropLegacyHeaderTables(pool);
  await pool.query(createUserProgressTrackingTableStatement);
  await pool.query(createUserTrackingTableStatement());
  await pool.query(createUserTrackingHistoryTableStatement);
  await pool.query(createUserExerciseLogsTableStatement);
  await pool.query(createUserWaterTableStatement);
  await migrateLegacyShoppingLists(pool);
  await ensurePlanRowStateColumns(pool);
};
