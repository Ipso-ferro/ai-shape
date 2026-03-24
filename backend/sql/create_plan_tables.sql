USE ai_shape;

CREATE TABLE IF NOT EXISTS user_diet_plan (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
  summary JSON DEFAULT NULL,
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
  UNIQUE KEY uk_user_diet_plan_id (id),
  CONSTRAINT fk_user_diet_plan_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_recipe_plan (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
  summary JSON DEFAULT NULL,
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
  UNIQUE KEY uk_user_recipe_plan_id (id),
  CONSTRAINT fk_user_recipe_plan_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_workout_plan_days (
  id CHAR(36) NOT NULL,
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
  complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, day_number),
  UNIQUE KEY uk_user_workout_plan_days_id (id),
  CONSTRAINT fk_user_workout_plan_days_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_market_single_food_list (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
  days_covered TINYINT UNSIGNED NOT NULL DEFAULT 7,
  shopping_list JSON NOT NULL,
  checked_items JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, plan_week),
  UNIQUE KEY uk_shopping_market_single_food_list_id (id),
  CONSTRAINT fk_shopping_market_single_food_list_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_market_recipes_list (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  plan_week VARCHAR(20) NOT NULL DEFAULT 'current',
  days_covered TINYINT UNSIGNED NOT NULL DEFAULT 7,
  shopping_list JSON NOT NULL,
  checked_items JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, plan_week),
  UNIQUE KEY uk_shopping_market_recipes_list_id (id),
  CONSTRAINT fk_shopping_market_recipes_list_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
