import {
  AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { SQL, sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: serial().primaryKey(),
    first_name: text().notNull(),
    last_name: text().notNull(),
    phone: varchar({ length: 20 }).notNull().unique(),
    email: text().notNull().unique(),
    is_verified: boolean().notNull().default(false),
    password: varchar({ length: 256 }),
    refresh_token: jsonb().default(sql`null`),
    created_at: timestamp().notNull().defaultNow(),
    updated_at: timestamp().notNull().defaultNow(),
  },
  (table) => {
    return [
      {
        emailIndex: uniqueIndex("email_idx").on(lower(table.email)),
      },
    ];
  }
);

// custom lower function
export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}

// a user can have many events
// a user can have many recommendations e.g hotels, restaurants, etc
// a user can have many reviews
// a user can have many bookings
// a user can have many payments
// a user can have many inv
//  a user can only have one role per time
export const user_verification = pgTable("user_verification", {
  id: serial().primaryKey(),
  user_id: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" }) // Added cascade delete
    .notNull(), // Made non-nullable
  token: text().notNull(),
  created_at: timestamp({ precision: 6, withTimezone: true }).notNull().defaultNow(),
  friend_email: text().default(sql`null`),
  updated_at: timestamp().notNull().defaultNow(),
  expires_at: timestamp({ precision: 2, withTimezone: true })
    .notNull()
    .default(sql`now() + interval '15 minutes'`),
});


export const user_verification_relations = relations(user_verification, ({ one }) => ({
  user: one(users, {
    fields: [user_verification.user_id],
    references: [users.id],
  }),
}));

export const user_relations = relations(users, ({ many }) => ({
  user_verifications: many(user_verification),
}));