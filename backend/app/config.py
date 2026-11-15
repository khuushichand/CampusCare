import os

from dotenv import load_dotenv

load_dotenv()

BACKEND_HOST = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

# Authoritative equipment risk score threshold for alert triggering
RISK_ALERT_THRESHOLD = int(os.getenv("RISK_ALERT_THRESHOLD", "80"))

# --------------------------------------------------
# REDIS TTL CONFIGURATION (Seconds)
# --------------------------------------------------

# Temporary processing lock lease: allows worker to complete event handling.
# Auto-expires to prevent deadlocks if a worker crashes before completion.
PROCESSING_LOCK_EXPIRY_SEC = int(os.getenv("PROCESSING_LOCK_EXPIRY_SEC", "30"))

# Incident creation lock lease: guards race condition during concurrent report grouping.
# Auto-expires quickly if a worker crashes during group evaluation.
CREATION_LOCK_EXPIRY_SEC = int(os.getenv("CREATION_LOCK_EXPIRY_SEC", "10"))

# Processed report idempotency retention period:
# Set to 7 days (604,800 seconds) by default to safely guard against duplicate
# re-deliveries during stream consumer recoveries, while preventing unbounded memory growth.
PROCESSED_REPORT_RETENTION_SEC = int(os.getenv("PROCESSED_REPORT_RETENTION_SEC", str(7 * 24 * 3600)))
