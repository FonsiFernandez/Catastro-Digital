"""add cadastral units

Revision ID: a91f6c3d2e47
Revises: 7613261623d1
Create Date: 2026-09-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a91f6c3d2e47"
down_revision: Union[str, Sequence[str], None] = "7613261623d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cadastral_units",

        sa.Column(
            "cadastral_ref",
            sa.String(length=20),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "parcel_ref",
            sa.String(length=14),
            nullable=False,
        ),

        sa.Column(
            "use",
            sa.String(length=120),
            nullable=True,
        ),

        sa.Column(
            "address",
            sa.String(length=500),
            nullable=True,
        ),

        sa.Column(
            "floor",
            sa.String(length=20),
            nullable=True,
        ),

        sa.Column(
            "door",
            sa.String(length=20),
            nullable=True,
        ),

        sa.Column(
            "built_area_m2",
            sa.Float(),
            nullable=True,
        ),

        sa.Column(
            "last_fetched_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_cadastral_units_parcel_ref",
        "cadastral_units",
        ["parcel_ref"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_cadastral_units_parcel_ref",
        table_name="cadastral_units",
    )

    op.drop_table("cadastral_units")