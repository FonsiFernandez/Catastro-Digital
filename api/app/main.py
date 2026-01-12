import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db import engine, init_db
from app.routers import parcels

app = FastAPI(title="CadWeb API", version="0.1.0")
app.include_router(parcels.router)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup() -> None:
    init_db()

@app.get("/health")
def health():
    # Comprueba conexión DB
    with engine.connect() as conn:
        conn.execute(text("SELECT 1;"))
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "CadWeb API running"}
