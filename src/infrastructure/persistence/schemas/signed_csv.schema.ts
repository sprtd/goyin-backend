import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const signed_csv = pgTable(
  "signed_csv",
  {
    id: serial().primaryKey(),
    csv_key: text("csv_key").notNull(),
    last_modified: timestamp("last_modified"),
    processed_count: integer("processed_count").default(0),
    duplicate_count: integer("duplicate_count").default(0),
    error_log: jsonb("error_log"),
    last_sync_at: timestamp("last_sync_at").notNull().defaultNow(),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueCsvKey: uniqueIndex("idx_signed_csv_key").on(table.csv_key),
  })
);

export const signed_csv_relations = relations(signed_csv, ({ one }) => ({}));
