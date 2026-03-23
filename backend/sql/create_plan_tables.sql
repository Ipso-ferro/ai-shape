USE ai_shape;

CREATE TABLE IF NOT EXISTS user_diet_plan (
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
  CONSTRAINT fk_user_diet_plan_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_recipe_plan (
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
  CONSTRAINT fk_user_recipe_plan_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
