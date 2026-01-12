import os
import time

from sqlalchemy import create_engine, text
from app.models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

def init_db() -> None:
    last_err = None

    for _ in range(15):
        try:
            with engine.begin() as conn:
                conn.execute(text("SELECT 1;"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
                Base.metadata.create_all(bind=conn)
            return
        except Exception as e:
            last_err = e
            time.sleep(2)

    raise last_err
