from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKBElement
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ParcelGroup(Base):
    __tablename__ = "parcel_groups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_hidden: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class Parcel(Base):
    __tablename__ = "parcels"

    cadastral_ref: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        default="#7c3aed",
        server_default=text("'#7c3aed'"),
    )
    group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("parcel_groups.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
        index=True,
    )
    geom_official: Mapped[WKBElement] = mapped_column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
