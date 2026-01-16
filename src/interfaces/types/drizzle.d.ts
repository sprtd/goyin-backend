import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@/infrastructure/persistence/index";

export type Drizzle = NodePgDatabase<typeof schema>;
