-- School Meal v2: additive migration only; old meals remain intact.
CREATE TABLE IF NOT EXISTS meal_revisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 meal_id bigint NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 previous_data jsonb NOT NULL,
 new_data jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_meal_revisions_meal ON meal_revisions(meal_id,recorded_at DESC);
CREATE OR REPLACE FUNCTION log_meal_revision() RETURNS trigger AS $$
BEGIN
 IF OLD.raw_menu IS DISTINCT FROM NEW.raw_menu
   OR OLD.raw_nutrition IS DISTINCT FROM NEW.raw_nutrition
   OR OLD.calorie_kcal IS DISTINCT FROM NEW.calorie_kcal
   OR OLD.nutrients IS DISTINCT FROM NEW.nutrients
 THEN
  INSERT INTO meal_revisions(meal_id,previous_data,new_data) VALUES(
   OLD.id,
   jsonb_build_object('menu',OLD.raw_menu,'nutrition',OLD.raw_nutrition,'kcal',OLD.calorie_kcal,'nutrients',OLD.nutrients,'origin',OLD.raw_origin),
   jsonb_build_object('menu',NEW.raw_menu,'nutrition',NEW.raw_nutrition,'kcal',NEW.calorie_kcal,'nutrients',NEW.nutrients,'origin',NEW.raw_origin)
  );
 END IF;
 RETURN NEW;
END
$$ LANGUAGE plpgsql;
CREATE OR REPLACE TRIGGER trg_meal_revision BEFORE UPDATE ON meals FOR EACH ROW EXECUTE FUNCTION log_meal_revision();
CREATE TABLE IF NOT EXISTS backfill_cursors (
 office_code text NOT NULL,
 school_code text NOT NULL,
 cursor_end date NOT NULL,
 completed boolean NOT NULL DEFAULT false,
 last_error text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(office_code,school_code),
 FOREIGN KEY(office_code,school_code) REFERENCES schools(office_code,school_code)
);
CREATE INDEX IF NOT EXISTS idx_meal_items_category ON meal_items(category);
CREATE INDEX IF NOT EXISTS idx_sync_runs_recent ON sync_runs(office_code,school_code,started_at DESC);
