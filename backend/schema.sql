-- KAS App Database Schema
-- Wave 4: Delivery
--
-- Tables:
--   app_instance    - User's generated apps
--   spec_version    - Immutable spec snapshots
--   generation_run  - Audit trail for generation attempts
--
-- Note: InsForge handles users table and auth internally

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- APP_INSTANCE: User's generated apps
-- =============================================================================
-- Each user can have multiple app instances (one per business they create)

CREATE TABLE app_instance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,  -- References InsForge auth.users
    name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    business_description TEXT,
    current_version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_app_instance_user_id ON app_instance(user_id);
CREATE INDEX idx_app_instance_active ON app_instance(user_id, is_active) WHERE is_active = true;

-- =============================================================================
-- SPEC_VERSION: Immutable spec snapshots
-- =============================================================================
-- Every spec change creates a new version (immutable history)

CREATE TABLE spec_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_instance_id UUID NOT NULL REFERENCES app_instance(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    spec_json JSONB NOT NULL,
    spec_hash TEXT NOT NULL,  -- SHA-256 of spec_json for integrity
    producer TEXT NOT NULL DEFAULT 'agent',  -- 'human' | 'agent'
    change_class TEXT NOT NULL DEFAULT 'S',  -- S (safe) | M (minor) | I (intermediate) | R (risky)
    change_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(app_instance_id, version)
);

-- Index for version lookups
CREATE INDEX idx_spec_version_app_instance ON spec_version(app_instance_id);
CREATE INDEX idx_spec_version_latest ON spec_version(app_instance_id, version DESC);

-- =============================================================================
-- GENERATION_RUN: Audit trail for all generation attempts
-- =============================================================================
-- Records every spec generation for cost tracking and debugging

CREATE TABLE generation_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_instance_id UUID REFERENCES app_instance(id) ON DELETE SET NULL,
    user_id UUID NOT NULL,  -- References InsForge auth.users

    -- Input
    business_name TEXT NOT NULL,
    business_description TEXT NOT NULL,
    business_type TEXT,  -- Detected or specified

    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    spec_version_id UUID REFERENCES spec_version(id),

    -- Generation source
    generation_method TEXT NOT NULL,  -- 'template' | 'llm_fresh' | 'llm_adaptation'
    template_used TEXT,  -- Template name if applicable

    -- Metrics (from cost-tracker)
    latency_ms INTEGER,
    token_count_input INTEGER,
    token_count_output INTEGER,
    cost_usd NUMERIC(10, 6),
    model_id TEXT,
    provider TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user history and analytics
CREATE INDEX idx_generation_run_user_id ON generation_run(user_id);
CREATE INDEX idx_generation_run_created ON generation_run(created_at DESC);
CREATE INDEX idx_generation_run_success ON generation_run(success, created_at DESC);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for app_instance updated_at
CREATE TRIGGER update_app_instance_updated_at
    BEFORE UPDATE ON app_instance
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- InsForge handles RLS via its auth system, but we add policies for direct access

ALTER TABLE app_instance ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_run ENABLE ROW LEVEL SECURITY;

-- Policies will be created by InsForge auth integration
-- Example policy (applied by InsForge):
-- CREATE POLICY "Users can only access their own apps"
--     ON app_instance FOR ALL
--     USING (auth.uid() = user_id);

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE app_instance IS 'User-created business apps. Each app has a unique spec.';
COMMENT ON TABLE spec_version IS 'Immutable spec snapshots. Version history for each app.';
COMMENT ON TABLE generation_run IS 'Audit log for all spec generation attempts.';

COMMENT ON COLUMN spec_version.producer IS 'Who created this version: human or agent';
COMMENT ON COLUMN spec_version.change_class IS 'Risk classification: S=safe, M=minor, I=intermediate, R=risky';
COMMENT ON COLUMN generation_run.generation_method IS 'How the spec was generated: template match, fresh LLM, or adaptation';
