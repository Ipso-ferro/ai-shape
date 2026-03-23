USE ai_shape;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE user_tracking_history;
TRUNCATE TABLE user_tracking;
TRUNCATE TABLE user_progress_tracking;
TRUNCATE TABLE user_shopping_list;
TRUNCATE TABLE user_workout_plan_days;
TRUNCATE TABLE user_recipe_plan;
TRUNCATE TABLE user_diet_plan;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;
