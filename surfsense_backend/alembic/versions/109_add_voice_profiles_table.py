"""Add voice profiles table for voice library

Revision ID: 109
Revises: 108
Create Date: 2026-03-21

Adds voice_profiles table for managing preset, designed, and cloned voices.
Voices are created in the library and referenced by speaker profiles.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "109"
down_revision: str | None = "108"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TYPE voice_type AS ENUM ('preset', 'design', 'clone');
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS voice_profiles (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            search_space_id INTEGER NOT NULL
                REFERENCES searchspaces(id) ON DELETE CASCADE,
            voice_type voice_type NOT NULL,
            preset_voice_id VARCHAR(100),
            design_instructions TEXT,
            clone_profile_id VARCHAR(255),
            clone_ref_text TEXT,
            style_instructions TEXT,
            language VARCHAR(10),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            created_by UUID REFERENCES "user"(id) ON DELETE SET NULL
        );
        """
    )
    op.execute(
        """
        CREATE INDEX idx_voice_profiles_search_space
        ON voice_profiles(search_space_id);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS voice_profiles;")
    op.execute("DROP TYPE IF EXISTS voice_type;")
