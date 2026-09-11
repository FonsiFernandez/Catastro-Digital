"""assign existing parcel groups to initial user

Revision ID: d4c8a7f1e2b3
Revises: c1f7a562d4e9
Create Date: 2026-09-10
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid


revision: str = "d4c8a7f1e2b3"
down_revision: Union[str, Sequence[str], None] = "c1f7a562d4e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INITIAL_USER_ID = uuid.UUID("da107adb-48e4-4ad0-8c52-f5b77b47b128")


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE parcel_groups
            SET user_id = :user_id
            WHERE user_id IS NULL
            """
        ).bindparams(user_id=INITIAL_USER_ID)
    )

    op.alter_column(
        "parcel_groups",
        "user_id",
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "parcel_groups",
        "user_id",
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=True,
    )

    op.execute(
        """
        UPDATE parcel_groups
        SET user_id = NULL
        """
    )