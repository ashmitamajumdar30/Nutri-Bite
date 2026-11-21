-- =====================================================================
-- NutriBite · DECODE. SCORE. PROTECT.
-- Relational schema (PostgreSQL + SQLite compatible)
--
-- Portability choices:
--   * Primary keys are TEXT (app-generated UUID/ULID) -> no SERIAL/AUTOINCREMENT.
--   * Booleans are INTEGER 0/1 with CHECK constraints.
--   * JSON payloads are stored as TEXT (cast to JSONB in Postgres if desired).
--   * Dates use DATE / TIMESTAMP with CURRENT_DATE / CURRENT_TIMESTAMP defaults.
-- SQLite only: run  PRAGMA foreign_keys = ON;  on every connection.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. users  (Screens 01, 02, 06)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                 TEXT PRIMARY KEY,
    full_name          TEXT        NOT NULL,
    phone              TEXT        NOT NULL UNIQUE,          -- E.164, e.g. +919876543210
    is_phone_verified  INTEGER     NOT NULL DEFAULT 0 CHECK (is_phone_verified IN (0,1)),
    age_years          INTEGER     CHECK (age_years BETWEEN 1 AND 120),
    gender             TEXT        CHECK (gender IN ('female','male','other')),
    height_cm          REAL        CHECK (height_cm > 0),
    weight_kg          REAL        CHECK (weight_kg > 0),
    -- Daily targets auto-calculated at sign-up (Screen 02) and shown on Screen 06
    goal_kcal          REAL        NOT NULL DEFAULT 2000,
    goal_protein_g     REAL        NOT NULL DEFAULT 60,
    goal_fiber_g       REAL        NOT NULL DEFAULT 25,
    goal_iron_mg       REAL        NOT NULL DEFAULT 18,
    added_sugar_max_g  REAL        NOT NULL DEFAULT 25,
    preferred_language TEXT        NOT NULL DEFAULT 'en',
    created_at         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 2. user_health_shields  (Screen 03 - conditions + allergies)
--    `key` values match the keys in health_rules.json
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_health_shields (
    id          TEXT PRIMARY KEY,
    user_id     TEXT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT      NOT NULL CHECK (kind IN ('condition','allergen')),
    key         TEXT      NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, kind, key),
    CHECK (
        (kind = 'condition' AND key IN
            ('diabetes','hypertension','high_cholesterol','heart','pcos_thyroid'))
     OR (kind = 'allergen'  AND key IN
            ('peanuts','tree nuts','gluten','lactose','soy','shellfish','eggs'))
    )
);
CREATE INDEX IF NOT EXISTS idx_shields_user ON user_health_shields (user_id);
CREATE INDEX IF NOT EXISTS idx_shields_kind_key ON user_health_shields (kind, key);

-- ---------------------------------------------------------------------
-- 3. indian_food_catalog  (packaged foods, drinks, home meals, street plates)
--    Nutrition is PER SERVING (serving_size + serving_unit describe it).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS indian_food_catalog (
    id               TEXT PRIMARY KEY,
    name             TEXT      NOT NULL,
    brand            TEXT,
    item_type        TEXT      NOT NULL CHECK (item_type IN ('packaged','drink','home_meal','street_plate')),
    category         TEXT,                                   -- biscuit, namkeen, dal, chaat...
    emoji            TEXT,
    barcode          TEXT UNIQUE,                            -- EAN-13, nullable
    serving_size     REAL      NOT NULL CHECK (serving_size > 0),
    serving_unit     TEXT      NOT NULL DEFAULT 'g' CHECK (serving_unit IN ('g','ml')),
    serving_label    TEXT,                                   -- "1 can (300 ml)", "1 plate"
    energy_kcal      REAL,
    protein_g        REAL,
    carbs_g          REAL,
    total_sugar_g    REAL,
    added_sugar_g    REAL,
    fiber_g          REAL,
    fat_g            REAL,
    sat_fat_g        REAL,
    trans_fat_g      REAL,
    sodium_mg        REAL,
    iron_mg          REAL,
    ingredients      TEXT,                                   -- raw label text, lowercase-matched by app
    allergens        TEXT NOT NULL DEFAULT '[]',             -- JSON array of allergen keys
    may_contain      TEXT NOT NULL DEFAULT '[]',             -- JSON array (cross-contact warnings)
    additives        TEXT NOT NULL DEFAULT '[]',             -- JSON array of INS codes
    verified         INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1)),
    source           TEXT,                                   -- "FSSAI label", "IFCT 2017", ...
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_name     ON indian_food_catalog (name);
CREATE INDEX IF NOT EXISTS idx_catalog_brand    ON indian_food_catalog (brand);
CREATE INDEX IF NOT EXISTS idx_catalog_type     ON indian_food_catalog (item_type);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON indian_food_catalog (category);

-- ---------------------------------------------------------------------
-- 4. scan_history  (Screens 07, 08, 09 - every label scan / plate snap)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_history (
    id               TEXT PRIMARY KEY,
    user_id          TEXT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    catalog_id       TEXT      REFERENCES indian_food_catalog(id) ON DELETE SET NULL,
    scan_type        TEXT      NOT NULL CHECK (scan_type IN ('label','plate')),
    product_name     TEXT      NOT NULL,
    raw_ocr_text     TEXT,
    ingredients      TEXT,
    -- Nutrition actually used for scoring (after any user OCR correction)
    energy_kcal      REAL,
    protein_g        REAL,
    fiber_g          REAL,
    iron_mg          REAL,
    added_sugar_g    REAL,
    sat_fat_g        REAL,
    sodium_mg        REAL,
    -- Shield result
    verdict          TEXT      NOT NULL CHECK (verdict IN ('green','amber','red')),
    verdict_reasons  TEXT      NOT NULL DEFAULT '[]',        -- JSON array of strings
    flagged_allergens TEXT     NOT NULL DEFAULT '[]',        -- JSON array
    flagged_additives TEXT     NOT NULL DEFAULT '[]',        -- JSON array of knownAdditives names
    suggested_swap   TEXT,
    -- Screen 09 correction flow
    was_corrected    INTEGER   NOT NULL DEFAULT 0 CHECK (was_corrected IN (0,1)),
    corrected_fields TEXT,                                   -- JSON {field:{from,to}}
    -- Screen 08 "Are you finally having this food?"
    consumed         INTEGER   NOT NULL DEFAULT 0 CHECK (consumed IN (0,1)),
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scans_user_time ON scan_history (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scans_verdict   ON scan_history (user_id, verdict);
CREATE INDEX IF NOT EXISTS idx_scans_catalog   ON scan_history (catalog_id);

-- ---------------------------------------------------------------------
-- 5. daily_nutrition_logs  (Screen 04 gaps; written when user taps "Yes, Update Gaps")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_nutrition_logs (
    id               TEXT PRIMARY KEY,
    user_id          TEXT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id          TEXT      REFERENCES scan_history(id) ON DELETE SET NULL,
    log_date         DATE      NOT NULL DEFAULT CURRENT_DATE,
    item_name        TEXT      NOT NULL,
    source           TEXT      NOT NULL DEFAULT 'scan' CHECK (source IN ('scan','meal_suggestion','manual')),
    energy_kcal      REAL      NOT NULL DEFAULT 0,
    protein_g        REAL      NOT NULL DEFAULT 0,
    fiber_g          REAL      NOT NULL DEFAULT 0,
    iron_mg          REAL      NOT NULL DEFAULT 0,
    added_sugar_g    REAL      NOT NULL DEFAULT 0,
    sat_fat_g        REAL      NOT NULL DEFAULT 0,
    sodium_mg        REAL      NOT NULL DEFAULT 0,
    logged_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON daily_nutrition_logs (user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_logs_scan      ON daily_nutrition_logs (scan_id);

-- ---------------------------------------------------------------------
-- Convenience view: per-day totals powering the "Nutritional Gaps" card
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_daily_totals;
CREATE VIEW v_daily_totals AS
SELECT  user_id,
        log_date,
        COUNT(*)             AS items_logged,
        SUM(energy_kcal)     AS energy_kcal,
        SUM(protein_g)       AS protein_g,
        SUM(fiber_g)         AS fiber_g,
        SUM(iron_mg)         AS iron_mg,
        SUM(added_sugar_g)   AS added_sugar_g,
        SUM(sat_fat_g)       AS sat_fat_g,
        SUM(sodium_mg)       AS sodium_mg
FROM    daily_nutrition_logs
GROUP BY user_id, log_date;

-- ---------------------------------------------------------------------
-- Demo seed: the user shown in the reference screens (Ashmita Majumdar)
-- ---------------------------------------------------------------------
INSERT INTO users (id, full_name, phone, is_phone_verified, age_years, gender,
                   height_cm, weight_kg, goal_kcal, goal_protein_g, goal_fiber_g,
                   goal_iron_mg, added_sugar_max_g)
VALUES ('u_demo_ashmita', 'Ashmita Majumdar', '+919876543210', 1, 24, 'female',
        162, 58, 1850, 60, 25, 18, 25)
ON CONFLICT DO NOTHING;

INSERT INTO user_health_shields (id, user_id, kind, key) VALUES
    ('s_demo_1', 'u_demo_ashmita', 'condition', 'diabetes'),
    ('s_demo_2', 'u_demo_ashmita', 'allergen',  'peanuts')
ON CONFLICT DO NOTHING;

-- Dashboard state on Screen 04 (protein 39, fiber 10, iron 10, added sugar 12)
INSERT INTO daily_nutrition_logs (id, user_id, log_date, item_name, source,
                                  energy_kcal, protein_g, fiber_g, iron_mg, added_sugar_g)
VALUES ('l_demo_1', 'u_demo_ashmita', CURRENT_DATE, 'Rolled Oats', 'scan', 380, 22, 6, 5, 4),
       ('l_demo_2', 'u_demo_ashmita', CURRENT_DATE, 'Curd Bowl',   'scan', 260, 17, 4, 5, 8)
ON CONFLICT DO NOTHING;
