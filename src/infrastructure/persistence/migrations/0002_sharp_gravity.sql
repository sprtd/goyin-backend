DROP INDEX "idx_users_survey_role_email";--> statement-breakpoint
ALTER TABLE "users_survey" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "users_survey" ADD COLUMN "profession" text;