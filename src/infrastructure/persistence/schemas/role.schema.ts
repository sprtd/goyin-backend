import { integer, pgEnum, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users.schema";

export const rolesEnum = pgEnum("name", ["host", "guest", "admin", "super_admin"]);

export const roles = pgTable("roles", {
  id: serial().primaryKey(),
  name: rolesEnum().notNull().unique(),
  description: text(),
  created_at: timestamp().notNull().defaultNow(),
  updated_at: timestamp().notNull().defaultNow(),
});

export const user_roles = pgTable(
  "user_roles",
  {
    user_id: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role_id: integer("role_id")
      .references(() => roles.id)
      .notNull(),
  },
  (table) => {
    return [
      {
        primaryKey: { columns: [table.role_id, table.user_id] },
      },
    ];
  }
);

// a user can have many roles
export const role_relations = relations(roles, ({ many }) => ({
  user: many(roles),
}));

export const user_role_relations = relations(user_roles, ({ one }) => ({
  user: one(users, {
    fields: [user_roles.user_id],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [user_roles.role_id],
    references: [roles.id],
  }),
}));
