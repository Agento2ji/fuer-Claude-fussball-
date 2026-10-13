-- odds_snapshots ist append-only: Quotenbewegungen sollen später vollständig
-- auswertbar sein. UPDATE und DELETE werden auf Datenbankebene abgelehnt.
CREATE OR REPLACE FUNCTION odds_snapshots_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'odds_snapshots ist append-only (% nicht erlaubt)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER odds_snapshots_no_update_delete
  BEFORE UPDATE OR DELETE ON odds_snapshots
  FOR EACH ROW EXECUTE FUNCTION odds_snapshots_append_only();
--> statement-breakpoint
CREATE TRIGGER odds_snapshots_no_truncate
  BEFORE TRUNCATE ON odds_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION odds_snapshots_append_only();
