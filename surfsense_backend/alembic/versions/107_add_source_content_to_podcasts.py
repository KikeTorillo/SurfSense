"""Add source_content and user_prompt to podcasts table

Revision ID: 107
Revises: 106
Create Date: 2026-03-18

Adds source_content and user_prompt columns to the podcasts table
so failed podcasts can be retried with the original input data.
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "107"
down_revision: str | None = "106"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("podcasts", sa.Column("source_content", sa.Text(), nullable=True))
    op.add_column("podcasts", sa.Column("user_prompt", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("podcasts", "user_prompt")
    op.drop_column("podcasts", "source_content")
