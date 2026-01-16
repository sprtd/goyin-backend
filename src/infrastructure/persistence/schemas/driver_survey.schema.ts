import { relations } from "drizzle-orm";
import { users_survey } from "./users_survey.schema";

/**
 * driver_survey is a conceptual schema that uses the users_survey table with role='driver'.
 * This avoids table duplication and allows unified deduplication logic across all survey types.
 *
 * To query driver surveys:
 *   db.select().from(users_survey).where(eq(users_survey.role, 'driver'))
 *
 * Driver CSV files are stored in R2 with prefix: csv/drivers/
 */

export const driver_survey_relations = relations(users_survey, ({ one }) => ({}));

export const getDriverSurveys = () => users_survey;
