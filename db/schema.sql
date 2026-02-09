-- Sweets Galore Database Schema
-- Tables for users and scores with Row Level Security

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sg_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_sg_users_email ON sg_users(email);

-- ============================================
-- SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sg_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES sg_users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0),
    max_tier_reached INTEGER DEFAULT 1,
    pieces_merged INTEGER DEFAULT 0,
    game_duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sg_scores_user_id ON sg_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_sg_scores_score ON sg_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_sg_scores_created_at ON sg_scores(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on both tables
ALTER TABLE sg_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_scores ENABLE ROW LEVEL SECURITY;

-- Create a role for the application (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sg_app') THEN
        CREATE ROLE sg_app;
    END IF;
END
$$;

-- Create a role for anonymous/public access (leaderboard viewing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sg_anon') THEN
        CREATE ROLE sg_anon;
    END IF;
END
$$;

-- ============================================
-- POLICIES FOR sg_users
-- ============================================

-- Users can only see their own full record (including email)
CREATE POLICY users_self_select ON sg_users
    FOR SELECT
    USING (id = current_setting('app.current_user_id', true)::UUID);

-- App role can insert new users
CREATE POLICY users_app_insert ON sg_users
    FOR INSERT
    TO sg_app
    WITH CHECK (true);

-- Users can update their own record
CREATE POLICY users_self_update ON sg_users
    FOR UPDATE
    USING (id = current_setting('app.current_user_id', true)::UUID)
    WITH CHECK (id = current_setting('app.current_user_id', true)::UUID);

-- ============================================
-- POLICIES FOR sg_scores
-- ============================================

-- Anyone can view scores (for leaderboard) - but this doesn't expose emails
CREATE POLICY scores_public_select ON sg_scores
    FOR SELECT
    USING (true);

-- Users can only insert their own scores
CREATE POLICY scores_self_insert ON sg_scores
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

-- Users can only delete their own scores
CREATE POLICY scores_self_delete ON sg_scores
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- ============================================
-- VIEWS FOR PUBLIC ACCESS (LEADERBOARD)
-- ============================================

-- Public leaderboard view that hides email addresses
CREATE OR REPLACE VIEW sg_leaderboard AS
SELECT
    s.id,
    s.score,
    s.max_tier_reached,
    s.pieces_merged,
    s.game_duration_seconds,
    s.created_at,
    u.display_name,
    u.id as user_id
FROM sg_scores s
JOIN sg_users u ON s.user_id = u.id
ORDER BY s.score DESC;

-- Top scores view (for quick leaderboard queries)
CREATE OR REPLACE VIEW sg_top_scores AS
SELECT
    s.id,
    s.score,
    s.max_tier_reached,
    s.created_at,
    u.display_name
FROM sg_scores s
JOIN sg_users u ON s.user_id = u.id
ORDER BY s.score DESC
LIMIT 100;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get user's best score
CREATE OR REPLACE FUNCTION get_user_best_score(p_user_id UUID)
RETURNS TABLE(score INTEGER, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT s.score, s.created_at
    FROM sg_scores s
    WHERE s.user_id = p_user_id
    ORDER BY s.score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's rank
CREATE OR REPLACE FUNCTION get_user_rank(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    user_rank INTEGER;
BEGIN
    SELECT rank INTO user_rank
    FROM (
        SELECT user_id, RANK() OVER (ORDER BY MAX(score) DESC) as rank
        FROM sg_scores
        GROUP BY user_id
    ) ranked
    WHERE user_id = p_user_id;

    RETURN user_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on views and functions
GRANT SELECT ON sg_leaderboard TO sg_anon, sg_app;
GRANT SELECT ON sg_top_scores TO sg_anon, sg_app;
GRANT EXECUTE ON FUNCTION get_user_best_score TO sg_anon, sg_app;
GRANT EXECUTE ON FUNCTION get_user_rank TO sg_anon, sg_app;
