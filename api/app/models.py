from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String
from geoalchemy2 import Geometry

class Base(DeclarativeBase):
    pass

class Parcel(Base):
    __tablename__ = "parcels"

    cadastral_ref: Mapped[str] = mapped_column(String, primary_key=True)
    geom_official = mapped_column(Geometry(geometry_type="MULTIPOLYGON", srid=4326))
