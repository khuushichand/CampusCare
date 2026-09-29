from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.redis_client import check_redis
from app.seed_data import seed_equipment
from app.routers.equipment import router as equipment_router
from app.routers.reports import router as reports_router
from app.routers.incidents import router as incidents_router

# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(
    title="CampusCare Backend",
    description="FastAPI + Redis backend for CampusCare",
    version="1.0.0",
)


# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# ROUTERS
# --------------------------------------------------

app.include_router(equipment_router)
app.include_router(reports_router)
app.include_router(incidents_router)

# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": "CampusCare Backend is running",
        "status": "ok",
    }


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
async def health():
    redis_status = await check_redis()

    return {
        "backend": "ok",
        "redis": "connected" if redis_status else "disconnected",
    }


# --------------------------------------------------
# SEED DATABASE
# --------------------------------------------------

@app.post("/api/setup/seed")
async def seed_database():
    await seed_equipment()

    return {
        "message": "CampusCare seed data created successfully"
    }