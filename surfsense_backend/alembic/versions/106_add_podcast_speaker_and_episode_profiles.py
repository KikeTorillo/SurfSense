"""Add podcast speaker and episode profiles tables

Revision ID: 106
Revises: 105
Create Date: 2026-03-17

Adds podcast_speaker_profiles and podcast_episode_profiles tables
for multi-speaker podcast support with per-speaker voice configuration.
Also adds profile references and outline column to existing podcasts table.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "106"
down_revision: str | None = "105"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create podcast_speaker_profiles table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS podcast_speaker_profiles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            search_space_id INTEGER NOT NULL
                REFERENCES searchspaces(id) ON DELETE CASCADE,
            tts_provider VARCHAR(100),
            tts_model VARCHAR(100),
            speakers JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by UUID REFERENCES "user"(id) ON DELETE SET NULL
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_podcast_speaker_profiles_search_space_id
        ON podcast_speaker_profiles(search_space_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_podcast_speaker_profiles_created_at
        ON podcast_speaker_profiles(created_at);
        """
    )

    # Create podcast_episode_profiles table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS podcast_episode_profiles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            search_space_id INTEGER NOT NULL
                REFERENCES searchspaces(id) ON DELETE CASCADE,
            speaker_profile_id INTEGER
                REFERENCES podcast_speaker_profiles(id) ON DELETE SET NULL,
            num_segments INTEGER NOT NULL DEFAULT 3
                CHECK (num_segments BETWEEN 1 AND 10),
            language VARCHAR(10) NOT NULL DEFAULT 'en',
            default_briefing TEXT,
            outline_prompt TEXT,
            transcript_prompt TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by UUID REFERENCES "user"(id) ON DELETE SET NULL
        );
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_podcast_episode_profiles_search_space_id
        ON podcast_episode_profiles(search_space_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_podcast_episode_profiles_speaker_profile_id
        ON podcast_episode_profiles(speaker_profile_id);
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_podcast_episode_profiles_created_at
        ON podcast_episode_profiles(created_at);
        """
    )

    # Add profile references and outline to existing podcasts table
    op.execute(
        """
        ALTER TABLE podcasts
            ADD COLUMN IF NOT EXISTS speaker_profile_id INTEGER
                REFERENCES podcast_speaker_profiles(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS episode_profile_id INTEGER
                REFERENCES podcast_episode_profiles(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS outline JSONB,
            ADD COLUMN IF NOT EXISTS language VARCHAR(10),
            ADD COLUMN IF NOT EXISTS num_speakers INTEGER DEFAULT 2;
        """
    )


def downgrade() -> None:
    # Remove columns from podcasts table
    op.execute("ALTER TABLE podcasts DROP COLUMN IF EXISTS num_speakers")
    op.execute("ALTER TABLE podcasts DROP COLUMN IF EXISTS language")
    op.execute("ALTER TABLE podcasts DROP COLUMN IF EXISTS outline")
    op.execute("ALTER TABLE podcasts DROP COLUMN IF EXISTS episode_profile_id")
    op.execute("ALTER TABLE podcasts DROP COLUMN IF EXISTS speaker_profile_id")

    # Drop episode profiles
    op.execute("DROP INDEX IF EXISTS ix_podcast_episode_profiles_created_at")
    op.execute("DROP INDEX IF EXISTS ix_podcast_episode_profiles_speaker_profile_id")
    op.execute("DROP INDEX IF EXISTS ix_podcast_episode_profiles_search_space_id")
    op.execute("DROP TABLE IF EXISTS podcast_episode_profiles")

    # Drop speaker profiles
    op.execute("DROP INDEX IF EXISTS ix_podcast_speaker_profiles_created_at")
    op.execute("DROP INDEX IF EXISTS ix_podcast_speaker_profiles_search_space_id")
    op.execute("DROP TABLE IF EXISTS podcast_speaker_profiles")
