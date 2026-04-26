# apps/backend/app

Core FastAPI application package.

## Files and folders
- `main.py`: application entrypoint that creates the FastAPI app and registers routes.
- `models.py`: Pydantic request/response models used by the API.
- `api/`: HTTP route definitions such as health checks and scan/fix endpoints.
- `services/`: business logic for sanitization, Semgrep execution, and AI calls.

## How the pieces fit together
- `main.py` boots the API.
- `api/` receives HTTP requests and coordinates the workflow.
- `services/` performs the actual work.
- `models.py` keeps request and response shapes consistent.
