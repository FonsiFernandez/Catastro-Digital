"""create cadastral and user parcels

Revision ID: e7f3b8c2a4d1
Revises: d4c8a7f1e2b3
Create Date: 2026-09-11
"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql


revision: str = "e7f3b8c2a4d1"
down_revision: Union[str, Sequence[str], None] = "d4c8a7f1e2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INITIAL_USER_ID = uuid.UUID(
    "da107adb-48e4-4ad0-8c52-f5b77b47b128"
)


def upgrade() -> None:

    op.create_table(
        "cadastral_parcels",

        sa.Column(
            "cadastral_ref",
            sa.String(length=20),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "geom_official",
            Geometry(
                geometry_type="MULTIPOLYGON",
                srid=4326,
            ),
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

    op.create_table(
        "user_parcels",

        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
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
            "name",
            sa.String(length=160),
            nullable=True,
        ),

        sa.Column(
            "notes",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "color",
            sa.String(length=7),
            nullable=False,
            server_default=sa.text("'#7c3aed'"),
        ),

        sa.Column(
            "group_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
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

        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_user_parcels_user_id",
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["cadastral_ref"],
            ["cadastral_parcels.cadastral_ref"],
            name="fk_user_parcels_cadastral_ref",
            ondelete="RESTRICT",
        ),

        sa.ForeignKeyConstraint(
            ["group_id"],
            ["parcel_groups.id"],
            name="fk_user_parcels_group_id",
            ondelete="SET NULL",
        ),

        sa.UniqueConstraint(
            "user_id",
            "cadastral_ref",
            name="uq_user_parcels_user_ref",
        ),
    )

    op.create_index(
        "ix_user_parcels_user_id",
        "user_parcels",
        ["user_id"],
    )

    op.create_index(
        "ix_user_parcels_cadastral_ref",
        "user_parcels",
        ["cadastral_ref"],
    )

    op.create_index(
        "ix_user_parcels_group_id",
        "user_parcels",
        ["group_id"],
    )

    op.execute(
        """
        INSERT INTO cadastral_parcels (
            cadastral_ref,
            geom_official,
            last_fetched_at,
            created_at,
            updated_at
        )
        SELECT
            cadastral_ref,
            geom_official,
            last_fetched_at,
            created_at,
            updated_at
        FROM parcels
        """
    )

    op.execute(
        f"""
        INSERT INTO user_parcels (
            user_id,
            cadastral_ref,
            name,
            notes,
            color,
            group_id,
            is_deleted,
            created_at,
            updated_at,
            deleted_at
        )
        SELECT
            '{INITIAL_USER_ID}'::uuid,
            cadastral_ref,
            name,
            notes,
            color,
            group_id,
            is_deleted,
            created_at,
            updated_at,
            deleted_at
        FROM parcels
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_parcels_group_id",
        table_name="user_parcels",
    )

    op.drop_index(
        "ix_user_parcels_cadastral_ref",
        table_name="user_parcels",
    )

    op.drop_index(
        "ix_user_parcels_user_id",
        table_name="user_parcels",
    )

    op.drop_table("user_parcels")
    op.drop_table("cadastral_parcels")