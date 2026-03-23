import { Pool, RowDataPacket } from "mysql2/promise";
import { mysqlPool } from "../pool";

const createDietStorageTableStatement = (tableName: string): string => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    user_id CHAR(36) NOT NULL,
    day_number TINYINT UNSIGNED NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    breakfast JSON NOT NULL,
    snack_1 JSON NOT NULL,
    lunch JSON NOT NULL,
    dinner JSON NOT NULL,
    snack_2 JSON NOT NULL,
    supplements JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, day_number),
    CONSTRAINT fk_${tableName}_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createWorkoutPlanDaysTableStatement = `
  CREATE TABLE IF NOT EXISTS user_workout_plan_days (
    user_id CHAR(36) NOT NULL,
    day_number TINYINT UNSIGNED NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    focus VARCHAR(255) NOT NULL,
    warm_up JSON NOT NULL,
    exercises JSON NOT NULL,
    cool_down JSON NOT NULL,
    total_duration VARCHAR(50) NOT NULL,
    estimated_calories_burned INT UNSIGNED NOT NULL DEFAULT 0,
    estimated_kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, day_number),
    CONSTRAINT fk_user_workout_plan_days_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserProgressTrackingTableStatement = `
  CREATE TABLE IF NOT EXISTS user_progress_tracking (
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
    CONSTRAINT fk_user_progress_tracking_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const createUserTrackingTableStatement = `
  CREATE TABLE IF NOT EXISTS user_tracking (
    user_id CHAR(36) NOT NULL,
    tracked_on DATE NOT NULL,
    target_kilojoules INT UNSIGNED NOT NULL DEFAULT 0,
    protein_grams INT UNSIGNED NOT NULL DEFAULT 0,
    carbs_grams INT UNSIGNED NOT NULL DEFAULT 0,
    fats_grams INT UNSIGNED NOT NULL DEFAULT 0,
    daily_calories_burned INT UNSIGNED NOT NULL DEFAULT 0,
    daily_kilojoules_consumed INT UNSIGNED NOT NULL DEFAULT 0,
    daily_kilojoules_burned INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_tracking_user
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

const createUserShoppingListTableStatement = `
  CREATE TABLE IF NOT EXISTS user_shopping_list (
    user_id CHAR(36) NOT NULL,
    days_covered TINYINT UNSIGNED NOT NULL DEFAULT 7,
    shopping_list JSON NOT NULL,
    checked_items JSON DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_shopping_list_user
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

  if (recipeTableExists) {
    await pool.query(createDietStorageTableStatement("user_diet_plan"));
    await pool.query(createDietStorageTableStatement("user_recipe_plan"));
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
        user_id,
        day_number,
        day_name,
        breakfast,
        snack_1,
        lunch,
        dinner,
        snack_2,
        supplements
      )
      SELECT
        legacy_diet_days.user_id,
        legacy_diet_days.day_number,
        legacy_diet_days.day_name,
        legacy_diet_days.breakfast,
        legacy_diet_days.snack_1,
        legacy_diet_days.lunch,
        legacy_diet_days.dinner,
        legacy_diet_days.snack_2,
        legacy_diet_days.supplements
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
        user_id,
        day_number,
        day_name,
        breakfast,
        snack_1,
        lunch,
        dinner,
        snack_2,
        supplements
      )
      SELECT
        legacy_diet_days.user_id,
        legacy_diet_days.day_number,
        legacy_diet_days.day_name,
        legacy_diet_days.breakfast,
        legacy_diet_days.snack_1,
        legacy_diet_days.lunch,
        legacy_diet_days.dinner,
        legacy_diet_days.snack_2,
        legacy_diet_days.supplements
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

  if (!legacyWorkoutHeaderExists) {
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
        user_id,
        day_number,
        day_name,
        focus,
        warm_up,
        exercises,
        cool_down,
        total_duration
      )
      SELECT
        user_id,
        day_number,
        day_name,
        focus,
        warm_up,
        exercises,
        cool_down,
        total_duration
      FROM user_workout_plan_days
    `,
  );

  await pool.query("DROP TABLE user_workout_plan_days");
  await pool.query("RENAME TABLE user_workout_plan_days_tmp TO user_workout_plan_days");
};

const dropLegacyHeaderTables = async (pool: Pool): Promise<void> => {
  if (await tableExists(pool, "user_diet_plans")) {
    await pool.query("DROP TABLE user_diet_plans");
  }

  if (await tableExists(pool, "user_workout_plans")) {
    await pool.query("DROP TABLE user_workout_plans");
  }
};

const ensureShoppingTrackingColumns = async (pool: Pool): Promise<void> => {
  if (!await tableExists(pool, "user_shopping_list")) {
    return;
  }

  if (!await columnExists(pool, "user_shopping_list", "checked_items")) {
    await pool.query(
      `
        ALTER TABLE user_shopping_list
        ADD COLUMN checked_items JSON NULL AFTER shopping_list
      `,
    );
  }
};

export const initializeDatabaseSchema = async (
  pool: Pool = mysqlPool,
): Promise<void> => {
  await ensureGoogleIdentityColumns(pool);
  await ensureEnergyUnitPreferenceColumn(pool);
  await ensureJsonColumn(pool, "supplementation", "favorite_foods");
  await ensureJsonColumn(pool, "diet_plan_summary", "kind_of_diet");
  await ensureJsonColumn(pool, "workout_plan_overview", "diet_plan_summary");

  await migrateLegacyPlanSummaries(pool);
  await migrateLegacyDietDays(pool);
  await migrateLegacyWorkoutDays(pool);
  await ensureWorkoutDayMetricColumns(pool);
  await dropLegacyHeaderTables(pool);
  await pool.query(createUserProgressTrackingTableStatement);
  await pool.query(createUserTrackingTableStatement);
  await pool.query(createUserTrackingHistoryTableStatement);
  await pool.query(createUserShoppingListTableStatement);
  await ensureShoppingTrackingColumns(pool);
};
