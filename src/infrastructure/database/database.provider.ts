import { drizzle } from "drizzle-orm/neon-serverless";
import { ConfigService } from "@nestjs/config";
import * as schema from "../persistence/index";
import { Logger } from "@nestjs/common";
import { neonConfig, Pool } from "@neondatabase/serverless";
import WebSocket from "ws";

export const DATABASE_CONNECTION = Symbol("DATABASE_CONNECTION");
const connectionProvider = {
  provide: DATABASE_CONNECTION,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const logger = new Logger("DatabaseModule");
    const databaseConfiguration = configService.get<string>("DATABASE_URL");

    // Enable WebSocket connections for Neon
    neonConfig.webSocketConstructor = WebSocket;
    // Create a pool for transactions support
    const pool = new Pool({ connectionString: databaseConfiguration });
    const db = drizzle(pool, { schema });

    logger.log("Database connection established with transaction support");

    return db;
  },
};

export default connectionProvider;
