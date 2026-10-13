CREATE TYPE "public"."card_type" AS ENUM('yellow', 'yellow_red', 'red');--> statement-breakpoint
CREATE TYPE "public"."competition_type" AS ENUM('league', 'cup', 'international');--> statement-breakpoint
CREATE TYPE "public"."devig_method" AS ENUM('proportional', 'shin', 'power');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('competition', 'team', 'player', 'match', 'bookmaker');--> statement-breakpoint
CREATE TYPE "public"."injury_status" AS ENUM('injured', 'doubtful');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'finished', 'postponed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('goalkeeper', 'defender', 'midfielder', 'forward');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."suspension_reason" AS ENUM('yellow_accumulation', 'yellow_red', 'red', 'other');--> statement-breakpoint
CREATE TABLE "bookmakers" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"show_in_comparison" boolean NOT NULL,
	"use_for_fair_price" boolean NOT NULL,
	"ggl_license_verified" boolean DEFAULT false NOT NULL,
	"ggl_license_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmakers_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"country" text DEFAULT 'DE' NOT NULL,
	"broadcaster" text NOT NULL,
	"is_paid" boolean NOT NULL,
	"url" text,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"match_id" integer NOT NULL,
	"competition_id" integer NOT NULL,
	"type" "card_type" NOT NULL,
	"minute" smallint,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"type" "competition_type" NOT NULL,
	"has_match_pages" boolean DEFAULT false NOT NULL,
	"yellow_card_suspension_threshold" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"start_date" date,
	"end_date" date,
	"is_loan" boolean DEFAULT false NOT NULL,
	"market_value_eur" integer,
	"market_value_date" date,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"base_url" text NOT NULL,
	"priority" smallint NOT NULL,
	"status" text NOT NULL,
	"license_note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "external_ids" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_id" integer NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "injuries" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"status" "injury_status" NOT NULL,
	"injury_type" text,
	"description" text,
	"since" date,
	"expected_return" date,
	"ended_at" date,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineups" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"is_probable" boolean NOT NULL,
	"is_starter" boolean NOT NULL,
	"position_label" text,
	"shirt_number" smallint,
	"formation" text,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" integer NOT NULL,
	"season" text NOT NULL,
	"matchday" smallint,
	"stage" text,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"kickoff_at" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"home_score" smallint,
	"away_score" smallint,
	"venue" text,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_distinct_teams" CHECK ("matches"."home_team_id" <> "matches"."away_team_id")
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"summary" text,
	"published_at" timestamp with time zone NOT NULL,
	"player_id" integer,
	"team_id" integer,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	CONSTRAINT "news_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "odds_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"bookmaker_id" integer NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"line" numeric(5, 2),
	"price" numeric(8, 3) NOT NULL,
	"bookmaker_updated_at" timestamp with time zone,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	CONSTRAINT "odds_snapshots_price_gt_1" CHECK ("odds_snapshots"."price" > 1)
);
--> statement-breakpoint
CREATE TABLE "player_match_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"minutes" smallint NOT NULL,
	"goals" smallint,
	"assists" smallint,
	"shots" smallint,
	"shots_on_target" smallint,
	"xg" numeric(6, 3),
	"xa" numeric(6, 3),
	"passes" smallint,
	"passes_completed" smallint,
	"key_passes" smallint,
	"duels" smallint,
	"duels_won" smallint,
	"dribbles_attempted" smallint,
	"dribbles_successful" smallint,
	"dispossessed" smallint,
	"tackles" smallint,
	"clearances" smallint,
	"errors_leading_to_goal" smallint,
	"fouls_committed" smallint,
	"yellow_cards" smallint,
	"red_cards" smallint,
	"rating" numeric(4, 2),
	"saves" smallint,
	"goals_conceded" smallint,
	"psxg_faced" numeric(6, 3),
	"clean_sheet" boolean,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"birth_date" date,
	"nationality" text,
	"position" "position",
	"detailed_position" text,
	"current_team_id" integer,
	"shirt_number" smallint,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suspensions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"reason" "suspension_reason" NOT NULL,
	"competition_id" integer,
	"matches_count" smallint NOT NULL,
	"triggered_by_match_id" integer,
	"first_eligible_match_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_match_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"goals" smallint,
	"goals_conceded" smallint,
	"xg" numeric(6, 3),
	"xga" numeric(6, 3),
	"possession_pct" numeric(5, 2),
	"passes" smallint,
	"pass_accuracy_pct" numeric(5, 2),
	"shots" smallint,
	"shots_on_target" smallint,
	"corners" smallint,
	"set_piece_goals" smallint,
	"ppda" numeric(6, 2),
	"goals_by_period" jsonb,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"country" text,
	"crest_url" text,
	"venue" text,
	"source_id" integer NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "value_bets" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"line" numeric(5, 2),
	"best_bookmaker_id" integer NOT NULL,
	"best_price" numeric(8, 3) NOT NULL,
	"fair_probability" numeric(7, 6) NOT NULL,
	"fair_price" numeric(8, 3) NOT NULL,
	"devig_method" "devig_method" NOT NULL,
	"ev" numeric(7, 5) NOT NULL,
	"kelly_quarter" numeric(7, 5) NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"odds_fetched_at" timestamp with time zone NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_ids" ADD CONSTRAINT "external_ids_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineups" ADD CONSTRAINT "lineups_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news" ADD CONSTRAINT "news_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_bookmaker_id_bookmakers_id_fk" FOREIGN KEY ("bookmaker_id") REFERENCES "public"."bookmakers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_current_team_id_teams_id_fk" FOREIGN KEY ("current_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_triggered_by_match_id_matches_id_fk" FOREIGN KEY ("triggered_by_match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_first_eligible_match_id_matches_id_fk" FOREIGN KEY ("first_eligible_match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match_stats" ADD CONSTRAINT "team_match_stats_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_bets" ADD CONSTRAINT "value_bets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_bets" ADD CONSTRAINT "value_bets_best_bookmaker_id_bookmakers_id_fk" FOREIGN KEY ("best_bookmaker_id") REFERENCES "public"."bookmakers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broadcasts_match_idx" ON "broadcasts" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "cards_player_competition_idx" ON "cards" USING btree ("player_id","competition_id");--> statement-breakpoint
CREATE INDEX "contracts_player_idx" ON "contracts" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_ids_source_entity_ext_uq" ON "external_ids" USING btree ("source_id","entity_type","external_id");--> statement-breakpoint
CREATE INDEX "external_ids_entity_idx" ON "external_ids" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "injuries_player_idx" ON "injuries" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lineups_match_player_kind_uq" ON "lineups" USING btree ("match_id","player_id","is_probable");--> statement-breakpoint
CREATE INDEX "matches_kickoff_idx" ON "matches" USING btree ("kickoff_at");--> statement-breakpoint
CREATE INDEX "matches_competition_season_idx" ON "matches" USING btree ("competition_id","season");--> statement-breakpoint
CREATE INDEX "matches_home_idx" ON "matches" USING btree ("home_team_id","kickoff_at");--> statement-breakpoint
CREATE INDEX "matches_away_idx" ON "matches" USING btree ("away_team_id","kickoff_at");--> statement-breakpoint
CREATE INDEX "news_player_idx" ON "news" USING btree ("player_id","published_at");--> statement-breakpoint
CREATE INDEX "news_team_idx" ON "news" USING btree ("team_id","published_at");--> statement-breakpoint
CREATE INDEX "odds_snapshots_match_market_idx" ON "odds_snapshots" USING btree ("match_id","market","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "player_match_stats_match_player_uq" ON "player_match_stats" USING btree ("match_id","player_id");--> statement-breakpoint
CREATE INDEX "player_match_stats_player_idx" ON "player_match_stats" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "players_name_birth_idx" ON "players" USING btree ("last_name","birth_date");--> statement-breakpoint
CREATE INDEX "players_team_idx" ON "players" USING btree ("current_team_id");--> statement-breakpoint
CREATE INDEX "suspensions_player_idx" ON "suspensions" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_match_stats_match_team_uq" ON "team_match_stats" USING btree ("match_id","team_id");--> statement-breakpoint
CREATE INDEX "value_bets_match_idx" ON "value_bets" USING btree ("match_id","computed_at");