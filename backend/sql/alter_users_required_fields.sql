USE ai_shape;

SET @add_favoriete_coucine_recipes = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'favoriete_coucine_recipes'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN favoriete_coucine_recipes JSON NULL AFTER favorite_foods'
  )
);

PREPARE stmt FROM @add_favoriete_coucine_recipes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_is_pro = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'is_pro'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN is_pro BOOLEAN NULL AFTER favoriete_coucine_recipes'
  )
);

PREPARE stmt FROM @add_is_pro;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_train_location = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'train_location'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN train_location VARCHAR(120) NULL AFTER level_activity'
  )
);

PREPARE stmt FROM @add_train_location;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_supplementation = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'supplementation'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN supplementation JSON NULL AFTER favorite_foods'
  )
);

PREPARE stmt FROM @add_supplementation;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_kind_of_diet = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'kind_of_diet'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN kind_of_diet VARCHAR(100) NULL AFTER diet'
  )
);

PREPARE stmt FROM @add_kind_of_diet;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_target_weight = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'target_weight'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN target_weight DECIMAL(6,2) NULL AFTER weight'
  )
);

PREPARE stmt FROM @add_target_weight;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_cheat_weekly_meal = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'cheat_weekly_meal'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN cheat_weekly_meal BOOLEAN NOT NULL DEFAULT FALSE AFTER kind_of_diet'
  )
);

PREPARE stmt FROM @add_cheat_weekly_meal;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_diet_plan_summary = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'diet_plan_summary'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN diet_plan_summary JSON NULL AFTER kind_of_diet'
  )
);

PREPARE stmt FROM @add_diet_plan_summary;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_workout_plan_overview = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'workout_plan_overview'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN workout_plan_overview JSON NULL AFTER diet_plan_summary'
  )
);

PREPARE stmt FROM @add_workout_plan_overview;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_number_of_meals = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'number_of_meals'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN number_of_meals SMALLINT UNSIGNED NULL AFTER time_to_train'
  )
);

PREPARE stmt FROM @add_number_of_meals;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_energy_unit_preference = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'energy_unit_preference'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN energy_unit_preference VARCHAR(10) NOT NULL DEFAULT ''kj'' AFTER kind_of_diet'
  )
);

PREPARE stmt FROM @add_energy_unit_preference;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_calories_target = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'calories_target'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN calories_target INT UNSIGNED NULL AFTER number_of_meals'
  )
);

PREPARE stmt FROM @add_calories_target;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_kilojoules_target = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'kilojoules_target'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN kilojoules_target INT UNSIGNED NULL AFTER calories_target'
  )
);

PREPARE stmt FROM @add_kilojoules_target;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_protein_target = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'protein_target'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN protein_target DECIMAL(6,2) NULL AFTER kilojoules_target'
  )
);

PREPARE stmt FROM @add_protein_target;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_carbs_target = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'carbs_target'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN carbs_target DECIMAL(6,2) NULL AFTER protein_target'
  )
);

PREPARE stmt FROM @add_carbs_target;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_fats_target = (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'ai_shape'
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'fats_target'
    ),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN fats_target DECIMAL(6,2) NULL AFTER carbs_target'
  )
);

PREPARE stmt FROM @add_fats_target;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE users
SET
  is_pro = COALESCE(is_pro, FALSE);

ALTER TABLE users
  MODIFY COLUMN name VARCHAR(120) NULL,
  MODIFY COLUMN age TINYINT UNSIGNED NULL,
  MODIFY COLUMN gender VARCHAR(50) NULL,
  MODIFY COLUMN weight DECIMAL(6,2) NULL,
  MODIFY COLUMN target_weight DECIMAL(6,2) NULL,
  MODIFY COLUMN height DECIMAL(6,2) NULL,
  MODIFY COLUMN goal VARCHAR(255) NULL,
  MODIFY COLUMN diet VARCHAR(100) NULL,
  MODIFY COLUMN kind_of_diet VARCHAR(100) NULL,
  MODIFY COLUMN cheat_weekly_meal BOOLEAN NOT NULL DEFAULT FALSE,
  MODIFY COLUMN diet_plan_summary JSON NULL,
  MODIFY COLUMN workout_plan_overview JSON NULL,
  MODIFY COLUMN avoided_foods JSON NULL,
  MODIFY COLUMN allergies JSON NULL,
  MODIFY COLUMN level_activity VARCHAR(100) NULL,
  MODIFY COLUMN train_location VARCHAR(120) NULL,
  MODIFY COLUMN time_to_train SMALLINT UNSIGNED NULL,
  MODIFY COLUMN number_of_meals SMALLINT UNSIGNED NULL,
  MODIFY COLUMN calories_target INT UNSIGNED NULL,
  MODIFY COLUMN kilojoules_target INT UNSIGNED NULL,
  MODIFY COLUMN protein_target DECIMAL(6,2) NULL,
  MODIFY COLUMN carbs_target DECIMAL(6,2) NULL,
  MODIFY COLUMN fats_target DECIMAL(6,2) NULL,
  MODIFY COLUMN injuries JSON NULL,
  MODIFY COLUMN favorite_foods JSON NULL,
  MODIFY COLUMN supplementation JSON NULL,
  MODIFY COLUMN favoriete_coucine_recipes JSON NULL,
  MODIFY COLUMN is_pro BOOLEAN NOT NULL DEFAULT FALSE;
