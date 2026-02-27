import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { ensureAppTables } from "./db/bootstrap.js";
import { prisma } from "./lib/prisma.js";
import { verifySourceTables } from "./services/source-data.service.js";

async function bootstrap() {
  await prisma.$connect();
  await ensureAppTables();
  await verifySourceTables();
}

async function start() {
  await bootstrap();
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ai-shape backend listening on http://localhost:${env.PORT}`);
  });
}

start().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start backend", error);
  await prisma.$disconnect();
  process.exit(1);
});
