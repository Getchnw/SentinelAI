# SentinelAI Architecture

## High-level Flow
1. VS Code extension reads selected code or current file context.
2. Extension sends request to FastAPI with language, filename, and snippet.
3. Backend sanitizes sensitive values and stores reversible mapping.
4. Semgrep scans sanitized code and returns findings.
5. AI engine builds prompt from findings and gets fix from local LLM (Ollama).
6. Backend de-sanitizes fixed code and returns result + diagnostics metadata.
7. Extension renders diagnostics, diff view, and Apply Fix action.

## Service Boundaries
- apps/backend: FastAPI gateway, Semgrep runner, sanitizer, AI orchestration.
- apps/extension: VS Code extension host logic (diagnostics, code actions, HTTP client).
- apps/webview-ui: React/Tailwind UI rendered in VS Code Webview.
- qa: Security test cases and end-to-end validation scripts.

## Data Contract
See contracts/scan-fix-contract.md for request and response schema.

## Non-functional Requirements
- Timeout policy: Semgrep <= 20s, LLM <= 45s.
- Traceability: attach request_id in every response.
- Reliability: graceful fallback when Semgrep or LLM fails.
- Security: never send raw secrets to LLM.
