"""baseline existing database

Revision ID: e499a437c1d8
Revises:
Create Date: 2026-09-10 10:14:14.133996

This baseline recreates the legacy schema expected by the following
migrations when Catastro Digital is installed on a fresh database.

Existing databases that have already applied revision e499a437c1d8
will not execute this migration again.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects import postgresql


revision: str = "e499a437c1d8"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the legacy schema expected by the subsequent migrations."""

    op.create_table(
        "parcel_groups",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column(
            "is_hidden",
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
    )

    op.create_table(
        "parcels",
        sa.Column(
            "cadastral_ref",
            sa.String(length=20),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "geom_official",
            Geometry(geometry_type="MULTIPOLYGON", srid=4326),
            nullable=True,
        ),
        sa.Column(
            "last_fetched_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("name", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
            ["group_id"],
            ["parcel_groups.id"],
            name="fk_parcels_group_id",
            ondelete="SET NULL",
        ),
    )

    op.create_index(
        "ix_parcels_group_id",
        "parcels",
        ["group_id"],
        unique=False,
    )


def downgrade() -> None:
    """Remove the legacy baseline schema."""

    op.drop_index(
        "ix_parcels_group_id",
        table_name="parcels",
    )
    op.drop_table("parcels")
    op.drop_table("parcel_groups")
