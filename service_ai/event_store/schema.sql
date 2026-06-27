CREATE TABLE IF NOT EXISTS posture_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local_vision',
    type TEXT NOT NULL,
    severity TEXT,
    confidence REAL,
    duration_seconds INTEGER,
    metadata TEXT  -- JSON blob
);

CREATE TABLE IF NOT EXISTS workday_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'activity_tracker',
    type TEXT NOT NULL,
    duration_seconds INTEGER,
    metadata TEXT  -- JSON blob
);

CREATE TABLE IF NOT EXISTS nudge_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'nudge',
    type TEXT NOT NULL,
    nudge_type TEXT,
    mode TEXT,
    message TEXT,
    snooze_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS daily_summaries (
    date TEXT PRIMARY KEY,  -- YYYY-MM-DD
    active_time_minutes INTEGER,
    longest_session_minutes INTEGER,
    break_count INTEGER,
    idle_time_minutes INTEGER,
    posture_risk_events INTEGER,
    posture_strain TEXT,     -- low|medium|high
    break_debt TEXT,
    fatigue_risk TEXT,
    score INTEGER,
    baseline_json TEXT,      -- JSON blob of baseline comparison
    privacy_json TEXT        -- JSON blob: {webcam_processing, cloud_processing, raw_frames_stored, data_shared_with_employer}
);

-- Privacy invariant: raw_frames_stored is always 0.
-- This is enforced at the application layer, not stored.
