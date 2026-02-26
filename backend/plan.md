# AI Meal Plan Generation & Shopping List Integration

This plan outlines the steps required to satisfy all user requirements for OpenAI-generated meal planning and shopping list functionality via a DDD/Node.js backend and React frontend.

## 1. Environment & Configuration
- **Action**: Add the provided OpenAI API key to the `.env` and `.env.example` configurations. (Done immediately alongside this plan).

## 2. Database Schema (Prisma)
- **Update Application state**: 
  - Add `mealsPerDay` (Int, 1-6, default 3) and `dailyCalories` (Int, default 0) to `UserProfile`.
  - Create a new `WeeklyMealPlan` model with JSON fields for `weeklyMeals` and `weeklyIngredients`.
  - Link `WeeklyMealPlan` to `User` (or `UserProfile`) via a relational field.
  - Run `npx prisma db push` and `npx prisma generate` to sync changes.

## 3. Frontend Onboarding & Profile
- **`Onboarding.tsx`**: Add an extra step after Activity Level asking "How many meals per day do you prefer? (1 to 6)". Include this in the registration payload.
- **`Auth Context / User hook`**: Properly store and propagate the new integer field.

## 4. Backend TS Logic: Macros & Calories Calculation
- **Use Case modifications**: 
  - During User registration / Profile updates, calculate basal metabolic rate (BMR) based on gender, age, weight, and height (e.g., using Mifflin-St Jeor equation).
  - Apply the activity level multiplier to calculate Total Daily Energy Expenditure (TDEE).
  - Apply Goal adjustments (deficit/surplus) to establish target `dailyCalories`.
  - Calculate `macroTargets` (Protein, Carbs, Fat) by standard bodybuilding constants (e.g., 30/40/30) and save immediately to the `UserProfile`.

## 5. OpenAI Weekly Meal Generator Endpoint
- **Create a specialized service**: 
  - Construct an OpenAI completion request via the Vercel AI SDK (`@ai-sdk/openai`).
  - Send the user's `dailyCalories`, `macroTargets`, `diets`, `allergies`, and `mealsPerDay` using a highly-specific prompt.
  - Use `generateObject` with Zod to enforce a structured JSON response containing `weeklyMeals` (Array of 7 days, with configured meals per day) and `weeklyIngredients` (aggregated list).
  - Save the generated structured JSON into the new `WeeklyMealPlan` DB table.

## 6. OpenAI Shopping List Generator Endpoint
- **Create a shopping list service**:
  - Fetch the user's latest `WeeklyMealPlan`'s `weeklyIngredients`.
  - Feed these ingredients to OpenAI to classify into categories (Protein, Carbs, Fats, Veggies, Dairy, Other).
  - Convert output list directly into inserts for the `ShoppingItem` Prisma table so they render properly in the user's shopping view.
