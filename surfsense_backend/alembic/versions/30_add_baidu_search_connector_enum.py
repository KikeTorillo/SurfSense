"""Add BAIDU_SEARCH_API and BRAVE_SEARCH_API to searchsourceconnectortype enum

Revision ID: 30
Revises: 29

Changes:
1. Add BAIDU_SEARCH_API value to searchsourceconnectortype and documenttype enums
2. Add BRAVE_SEARCH_API value to searchsourceconnectortype and documenttype enums
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "30"
down_revision: str | None = "29"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add BAIDU_SEARCH_API and BRAVE_SEARCH_API to searchsourceconnectortype and documenttype enums."""

    for enum_value in ("BAIDU_SEARCH_API", "BRAVE_SEARCH_API"):
        for enum_type in ("searchsourceconnectortype", "documenttype"):
            op.execute(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_type t
                        JOIN pg_enum e ON t.oid = e.enumtypid
                        WHERE t.typname = '{enum_type}' AND e.enumlabel = '{enum_value}'
                    ) THEN
                        ALTER TYPE {enum_type} ADD VALUE '{enum_value}';
                    END IF;
                END
                $$;
                """
            )


def downgrade() -> None:
    """
    Downgrade is not supported for enum values in PostgreSQL.

    Removing enum values can break existing data and is generally not safe.
    This is intentionally left as a no-op for safety.
    """
    pass
