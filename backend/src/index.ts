// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { createApp } from './presentation/app';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma';
import { logger } from './infrastructure/logger';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main() {
    // Connect DB first
    await connectDatabase();
    logger.info('✅ Database connected');

    const app = createApp();

    const server = app.listen(PORT, () => {
        logger.info(`🚀 ProBody API running on http://localhost:${PORT}`);
        logger.info(`📡 Health: http://localhost:${PORT}/api/health`);
    });

    // ─── Graceful Shutdown ──────────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Shutting down gracefully…');
        server.close(async () => {
            await disconnectDatabase();
            logger.info('Goodbye.');
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
        logger.error({ err }, 'Uncaught Exception');
        process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
        logger.error({ reason }, 'Unhandled Promise Rejection');
        process.exit(1);
    });
}

main().catch((err) => {
    logger.error(err, 'Failed to start server');
    process.exit(1);
});
