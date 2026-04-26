# apps/backend

Backend service for SentinelAI.

## What this folder contains
- `app/`: FastAPI application code, models, API routes, and services.
- `tests/`: backend tests.
- `requirements.txt`: Python dependencies for the backend.

## Responsibilities
- Accept requests from the VS Code extension.
- Validate and normalize code input.
- Run secret redaction and Semgrep scanning.
- Send sanitized context to the AI engine.
- Return findings, fixed code, and errors back to the extension.
