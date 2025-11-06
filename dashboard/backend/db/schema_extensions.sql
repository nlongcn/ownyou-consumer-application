-- Dashboard Schema Extensions
-- Adds new fields and tables to support dashboard functionality
-- Note: LangMem uses a single 'memories' table with namespaced key-value storage
-- We'll add metadata columns directly to the memories table

-- Create cost tracking table
CREATE TABLE IF NOT EXISTS cost_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    run_date TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_name TEXT,
    total_cost REAL NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    email_count INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_run_date ON cost_tracking(run_date);

-- Create classification history table for tracking confidence evolution
CREATE TABLE IF NOT EXISTS classification_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    taxonomy_id INTEGER NOT NULL,
    confidence REAL NOT NULL,
    evidence_count INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_classification_history_user_taxonomy ON classification_history(user_id, taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_classification_history_snapshot_date ON classification_history(snapshot_date);

-- Create analysis runs table for tracking dashboard analysis sessions
CREATE TABLE IF NOT EXISTS analysis_runs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    run_date TEXT NOT NULL,
    emails_processed INTEGER NOT NULL,
    classifications_added INTEGER NOT NULL,
    classifications_updated INTEGER NOT NULL,
    total_cost REAL,
    duration_seconds REAL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_user_id ON analysis_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_run_date ON analysis_runs(run_date);
