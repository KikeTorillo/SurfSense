"""Add tts_configs table and tts_config_id to searchspaces

Revision ID: 108
Revises: 107
Create Date: 2026-03-18

Adds the tts_configs table for user-created TTS model configurations
and tts_config_id column to searchspaces for default TTS assignment.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "108"
down_revision: str | None = "107"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create TTSProvider enum
    ttsprovider_enum = sa.Enum(
        "KOKORO", "OPENAI", "AZURE", "VERTEX_AI",
        name="ttsprovider",
    )
    ttsprovider_enum.create(op.get_bind(), checkfirst=True)

    # Create tts_configs table
    op.create_table(
        "tts_configs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "provider",
            sa.Enum("KOKORO", "OPENAI", "AZURE", "VERTEX_AI", name="ttsprovider", create_type=False),
            nullable=False,
        ),
        sa.Column("custom_provider", sa.String(length=100), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("api_key", sa.String(), nullable=True),
        sa.Column("api_base", sa.String(length=500), nullable=True),
        sa.Column("litellm_params", sa.JSON(), nullable=True),
        sa.Column("search_space_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["search_space_id"],
            ["searchspaces.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tts_configs_name"), "tts_configs", ["name"], unique=False)

    # Add tts_config_id column to searchspaces
    op.add_column(
        "searchspaces",
        sa.Column("tts_config_id", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("searchspaces", "tts_config_id")
    op.drop_index(op.f("ix_tts_configs_name"), table_name="tts_configs")
    op.drop_table("tts_configs")
    sa.Enum(name="ttsprovider").drop(op.get_bind(), checkfirst=True)
