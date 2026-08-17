from __future__ import annotations

import os
import time
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .models import Base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://cadweb:cadweb@localhost:5432/cadweb",
)

engine: Engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _upgrade_legacy_schema() -> None:
    """Idempotently upgrade databases created by early Catastro Digital builds.

    The original project created only the geometry columns through SQLAlchemy while
    the API already expected grouping, colour and soft-delete columns. Keeping this
    migration here makes existing Docker volumes usable without destructive resets.
    """

    statements = [
        """
        ALTER TABLE parcel_groups
          ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        """,
        """
        ALTER TABLE parcels
          ADD COLUMN IF NOT EXISTS name VARCHAR(160),
          ADD COLUMN IF NOT EXISTS notes TEXT,
          ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#7c3aed',
          ADD COLUMN IF NOT EXISTS group_id UUID,
          ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
          ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
        """,
        "UPDATE parcel_groups SET is_hidden = FALSE WHERE is_hidden IS NULL",
        "UPDATE parcel_groups SET created_at = NOW() WHERE created_at IS NULL",
        "UPDATE parcel_groups SET updated_at = NOW() WHERE updated_at IS NULL",
        "UPDATE parcels SET color = '#7c3aed' WHERE color IS NULL",
        "UPDATE parcels SET is_deleted = FALSE WHERE is_deleted IS NULL",
        "UPDATE parcels SET created_at = NOW() WHERE created_at IS NULL",
        "UPDATE parcels SET updated_at = NOW() WHERE updated_at IS NULL",
        "ALTER TABLE parcel_groups ALTER COLUMN id SET DEFAULT gen_random_uuid()",
        "ALTER TABLE parcel_groups ALTER COLUMN is_hidden SET DEFAULT FALSE",
        "ALTER TABLE parcel_groups ALTER COLUMN created_at SET DEFAULT NOW()",
        "ALTER TABLE parcel_groups ALTER COLUMN updated_at SET DEFAULT NOW()",
        "ALTER TABLE parcel_groups ALTER COLUMN is_hidden SET NOT NULL",
        "ALTER TABLE parcel_groups ALTER COLUMN created_at SET NOT NULL",
        "ALTER TABLE parcel_groups ALTER COLUMN updated_at SET NOT NULL",
        "ALTER TABLE parcels ALTER COLUMN color SET DEFAULT '#7c3aed'",
        "ALTER TABLE parcels ALTER COLUMN is_deleted SET DEFAULT FALSE",
        "ALTER TABLE parcels ALTER COLUMN created_at SET DEFAULT NOW()",
        "ALTER TABLE parcels ALTER COLUMN updated_at SET DEFAULT NOW()",
        "ALTER TABLE parcels ALTER COLUMN color SET NOT NULL",
        "ALTER TABLE parcels ALTER COLUMN is_deleted SET NOT NULL",
        "ALTER TABLE parcels ALTER COLUMN created_at SET NOT NULL",
        "ALTER TABLE parcels ALTER COLUMN updated_at SET NOT NULL",
        """
        UPDATE parcels p
        SET group_id = NULL
        WHERE group_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM parcel_groups g WHERE g.id = p.group_id)
        """,
        "CREATE INDEX IF NOT EXISTS ix_parcels_group_id ON parcels(group_id)",
        "CREATE INDEX IF NOT EXISTS ix_parcels_is_deleted ON parcels(is_deleted)",
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint c
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid
             AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'parcels'::regclass
              AND c.contype = 'f'
              AND a.attname = 'group_id'
          ) THEN
            ALTER TABLE parcels
              ADD CONSTRAINT fk_parcels_group_id
              FOREIGN KEY (group_id)
              REFERENCES parcel_groups(id)
              ON DELETE SET NULL;
          END IF;
        END $$
        """,
    ]

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def init_db(max_attempts: int = 20, retry_delay: float = 1.5) -> None:
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))

            Base.metadata.create_all(bind=engine)
            _upgrade_legacy_schema()
            return
        except Exception as exc:  # startup retry is deliberately broad
            last_error = exc
            if attempt == max_attempts:
                break
            time.sleep(retry_delay)

    raise RuntimeError("Database initialisation failed") from last_error
