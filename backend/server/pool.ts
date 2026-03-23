import { createPool } from "mysql2/promise";
import { databaseConfig } from "./config";

export const mysqlPool = createPool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,
  connectionLimit: databaseConfig.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
});
