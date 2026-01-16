import { relations } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users_survey = pgTable(
  "users_survey",
  {
    id: serial().primaryKey(),
    role: text("role", { enum: ["user", "driver"] })
      .notNull()
      .default("user"),
    profession: text("profession"),
    email: text("email"),
    phone: text("phone"),
    name: text("name"),
    raw_data: jsonb("raw_data").notNull(),
    is_duplicate: integer("is_duplicate").default(0),
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idx_users_survey_role_phone").on(table.role, table.phone)]
);

export const survey_relations = relations(users_survey, () => ({}));
