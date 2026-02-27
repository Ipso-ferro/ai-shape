# AI Shape Backend (TypeScript + Prisma)

Backend is now TypeScript-based and uses Prisma Client for the app database tables (users, profiles, plans, logs, shopping, chat history).

Source nutrition/training datasets are read from existing tables:
- `recipes`
- `simple_foods` (fallback: `simple_fods`)
- `exercises`

## Run

1. Copy `.env.example` to `.env`
2. Set:
   - `DATABASE_URL` (defaults to `mysql://root:@127.0.0.1:3306/testFitApp`)
   - `OPENAI_API_KEY`
   - `JWT_SECRET`
3. Install and run:

```bash
npm install
npm run prisma:generate
npm run dev
```

## Main APIs

Auth:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

Profile:
- `GET /api/v1/profile`
- `PATCH /api/v1/profile`

AI Chat:
- `POST /api/v1/ai/diet/message`
- `POST /api/v1/ai/workout/message`
- `GET /api/v1/customers/:customerId/ai-plans`

Frontend compatibility:
- `POST /api/v1/ai/generate-weekly-meal-plan`
- `GET /api/v1/ai/weekly-meal-plan`
- `GET /api/v1/ai/daily-meals`
- `PUT /api/v1/ai/meals/:mealId/eaten`
- `POST /api/v1/ai/generate-workout-plan`
- `GET /api/v1/ai/workout-plan`
- `PUT /api/v1/ai/exercises/:exerciseLogId/completed`
- `POST /api/v1/ai/generate-shopping-list`
- `GET /api/v1/ai/shopping-list`
- `GET /api/v1/ai/today`

## MCP-style profile updates

Diet/workout chat messages can update user profile values when detected in message text (for example weight/activity/target adjustments). Applied changes are returned in `mcpChanges`.
