from pathlib import Path
from fastapi.staticfiles import StaticFiles

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_admin
from app.config import FRONTEND_URL
from app.redis_client import check_redis
from app.seed_data import seed_equipment
from app.routers.equipment import router as equipment_router
from app.routers.reports import router as reports_router
from app.routers.incidents import router as incidents_router
from app.routers.maintenance import router as maintenance_router
from app.routers.risk import router as risk_router
from app.routers.alerts import router as alerts_router
from app.routers.analytics import router as analytics_router

# --------------------------------------------------
# FASTAPI APP
# --------------------------------------------------

app = FastAPI(
    title="CampusCare Backend",
    description="FastAPI + Redis backend for CampusCare",
    version="1.0.0",
)

# --------------------------------------------------
# UPLOADED IMAGE SERVING
# --------------------------------------------------

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads",
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
    "http://localhost:5174",
    "http://127.0.0.1:5174",
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
app.include_router(maintenance_router)
app.include_router(risk_router)
app.include_router(alerts_router)
app.include_router(analytics_router)

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

@app.post("/api/setup/seed", dependencies=[Depends(require_admin)])
async def seed_database():
    await seed_equipment()

    return {
        "message": "CampusCare seed data created successfully"
    }