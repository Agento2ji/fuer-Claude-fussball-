CREATE TYPE "public"."job_status" AS ENUM('running', 'succeeded', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "data_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" integer NOT NULL,
	"field" text NOT NULL,
	"kept_source_id" integer NOT NULL,
	"kept_value" text,
	"other_source_id" integer NOT NULL,
	"other_value" text,
	"unconfirmed" boolean NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"status" "job_status" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"items_written" integer,
	"error" text,
	"details" jsonb
);
--> statement-breakpoint
DROP INDEX "broadcasts_match_idx";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "is_test_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "kickoff_time_known" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "data_conflicts" ADD CONSTRAINT "data_conflicts_kept_source_id_data_sources_id_fk" FOREIGN KEY ("kept_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_conflicts" ADD CONSTRAINT "data_conflicts_other_source_id_data_sources_id_fk" FOREIGN KEY ("other_source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_conflicts_entity_idx" ON "data_conflicts" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "job_runs_job_started_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "broadcasts_match_country_broadcaster_uq" ON "broadcasts" USING btree ("match_id","country","broadcaster");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_player_team_source_uq" ON "contracts" USING btree ("player_id","team_id","source_id");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_match_player_type_minute_uq" UNIQUE NULLS NOT DISTINCT("match_id","player_id","type","minute");--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_player_source_since_uq" UNIQUE NULLS NOT DISTINCT("player_id","source_id","since");--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_player_source_trigger_uq" UNIQUE NULLS NOT DISTINCT("player_id","source_id","reason","triggered_by_match_id");