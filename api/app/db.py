import os
import time
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

def init_db() -> None:
    # Reintentos: 30s máximo (15 * 2s)
    last_err = None
    for _ in range(15):
        try:
            with engine.begin() as conn:
                conn.execute(text("SELECT 1;"))
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            return
        except Exception as e:
            last_err = e
            time.sleep(2)

    # Si tras reintentos no conecta, lanza el error real
    raise last_err
