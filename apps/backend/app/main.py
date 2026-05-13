"""Application entry for FastAPI.

Ensure environment variables from a local .env are loaded before importing
other application modules which may read environment variables at import
time (for example `app.services.llm_client`).
"""

# Load environment variables from .env (if present) before other imports
try:
	from dotenv import load_dotenv, find_dotenv
	load_dotenv(find_dotenv())
except Exception:
	# If python-dotenv is not installed or fails, continue without crashing;
	# environment variables may be provided by the execution environment.
	pass

from fastapi import FastAPI
from app.api.routes import router


app = FastAPI(title="SentinelAI Backend", version="0.1.0")
app.include_router(router)
