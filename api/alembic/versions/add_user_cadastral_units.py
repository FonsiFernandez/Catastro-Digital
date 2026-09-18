"""add user cadastral units

Revision ID: b7d4a92e61c8
Revises: a91f6c3d2e47
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "b7d4a92e61c8"
down_revision: Union[str, Sequence[str], None] = "a91f6c3d2e47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_cadastral_units",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "cadastral_ref",
            sa.String(length=20),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["cadastral_ref"],
            ["cadastral_units.cadastral_ref"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "cadastral_ref",
            name="uq_user_cadastral_units_user_ref",
        ),
    )

    op.create_index(
        "ix_user_cadastral_units_user_id",
        "user_cadastral_units",
        ["user_id"],
    )

    op.create_index(
        "ix_user_cadastral_units_cadastral_ref",
        "user_cadastral_units",
        ["cadastral_ref"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_cadastral_units_cadastral_ref",
        table_name="user_cadastral_units",
    )

    op.drop_index(
        "ix_user_cadastral_units_user_id",
        table_name="user_cadastral_units",
    )

    op.drop_table(
        "user_cadastral_units",
    )