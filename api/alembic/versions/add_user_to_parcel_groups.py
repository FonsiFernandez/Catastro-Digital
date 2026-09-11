"""add user ownership to parcel groups

Revision ID: c1f7a562d4e9
Revises: 9b1d4f8a2c10
Create Date: 2026-09-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c1f7a562d4e9"
down_revision: Union[str, Sequence[str], None] = "9b1d4f8a2c10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "parcel_groups",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_parcel_groups_user_id",
        "parcel_groups",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index(
        "ix_parcel_groups_user_id",
        "parcel_groups",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_parcel_groups_user_id",
        table_name="parcel_groups",
    )

    op.drop_constraint(
        "fk_parcel_groups_user_id",
        "parcel_groups",
        type_="foreignkey",
    )

    op.drop_column(
        "parcel_groups",
        "user_id",
    )