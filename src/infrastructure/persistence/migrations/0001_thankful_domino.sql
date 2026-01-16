CREATE TABLE "signed_csv" (
	"id" serial PRIMARY KEY NOT NULL,
	"csv_key" text NOT NULL,
	"last_modified" timestamp,
	"processed_count" integer DEFAULT 0,
	"duplicate_count" integer DEFAULT 0,
	"error_log" jsonb,
	"last_sync_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_survey" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'respondent' NOT NULL,
	"email" text,
	"phone" text,
	"name" text,
	"raw_data" jsonb NOT NULL,
	"is_duplicate" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_signed_csv_key" ON "signed_csv" USING btree ("csv_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_survey_role_email" ON "users_survey" USING btree ("role","email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_survey_role_phone" ON "users_survey" USING btree ("role","phone");