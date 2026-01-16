import { relations, sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const files = pgTable("files", {
  id: serial().primaryKey(),
  file_purpose: text("role", {
    enum: ["profile_image"],
  }).notNull(),
  name: text(),
  photos: jsonb().notNull(),
  description: text(),
  profile_id: integer("profile_id").default(sql`null`),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

export const file_relations = relations(files, ({ one }) => ({
}));
