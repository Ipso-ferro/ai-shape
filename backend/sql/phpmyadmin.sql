CREATE DATABASE IF NOT EXISTS ai_shape
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ai_shape;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  google_sub VARCHAR(255) DEFAULT NULL,
  name VARCHAR(120) DEFAULT NULL,
  age TINYINT UNSIGNED DEFAULT NULL,
  gender VARCHAR(50) DEFAULT NULL,
  weight DECIMAL(6,2) DEFAULT NULL,
  height DECIMAL(6,2) DEFAULT NULL,
  goal VARCHAR(255) DEFAULT NULL,
  diet VARCHAR(100) DEFAULT NULL,
  kind_of_diet VARCHAR(100) DEFAULT NULL,
  energy_unit_preference VARCHAR(10) NOT NULL DEFAULT 'kj',
  diet_plan_summary JSON DEFAULT NULL,
  workout_plan_overview JSON DEFAULT NULL,
  avoided_foods JSON DEFAULT NULL,
  allergies JSON DEFAULT NULL,
  level_activity VARCHAR(100) DEFAULT NULL,
  train_location VARCHAR(120) DEFAULT NULL,
  time_to_train SMALLINT UNSIGNED DEFAULT NULL,
  number_of_meals SMALLINT UNSIGNED DEFAULT NULL,
  calories_target INT UNSIGNED DEFAULT NULL,
  kilojoules_target INT UNSIGNED DEFAULT NULL,
  protein_target DECIMAL(6,2) DEFAULT NULL,
  carbs_target DECIMAL(6,2) DEFAULT NULL,
  fats_target DECIMAL(6,2) DEFAULT NULL,
  injuries JSON DEFAULT NULL,
  favorite_foods JSON DEFAULT NULL,
  supplementation JSON DEFAULT NULL,
  favoriete_coucine_recipes JSON DEFAULT NULL,
  is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_google_sub (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

/*
Import this file in phpMyAdmin.

Recommended mapping from the backend:
- addNewUser(command): INSERT the account credentials and default flags
- saveDataUser(command): UPDATE the profile fields by id once registration is complete

Store array fields as JSON arrays, for example:
- avoided_foods: '["sugar","soda"]'
- allergies: '["peanuts"]'
- injuries: '["knee"]'
- favorite_foods: '["rice","chicken"]'
- supplementation: '["creatine","whey protein","vitamin d"]'
- favoriete_coucine_recipes: '["tacos al pastor","sushi bowl"]'
- is_pro: 0 or 1
- diet_plan_summary: current generated diet summary JSON
- workout_plan_overview: current generated workout overview JSON
- energy_unit_preference: 'kj' or 'cal'
- generated diet day slots are stored as JSON in user_diet_plan by user_id + day_number
- generated recipe day slots are stored as JSON in user_recipe_plan by user_id + day_number
- each meal JSON should include object, description, quantity, quantityUnit, ingredients[], macros, calories, kilojoules
- generated workout days are stored in user_workout_plan_days by user_id + day_number with estimated calorie and kJ burn columns
- user_progress_tracking stores one row per user per calendar day with meal/workout completion timestamps and consumed/burned totals for daily, monthly, and yearly progress summaries
- user_tracking stores the active server-side tracking summary with kJ target, daily macros, and burn totals
- user_tracking_history stores daily kJ consumed and kJ burned by user and tracked day
- user_shopping_list stores the weekly market list as JSON by user_id and is expected to use `gr` for foods and `ml` for liquids
*/
