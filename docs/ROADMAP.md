# SentinelAI Roadmap

## Phase 1 (Week 1): Skeleton + Contracts
- Define API contract and error model.
- Implement backend health endpoint and scan-fix endpoint skeleton.
- Build extension command to send selected code to backend.

## Phase 2 (Week 2): Security Scan + Diagnostics
- Wire Semgrep execution and parse findings.
- Show diagnostics (warning/error) in editor.
- Add QA baseline tests using OWASP samples.

## Phase 3 (Week 3): AI Fix + Diff UX
- Integrate Ollama API and prompt templates.
- Build webview chat panel with loading states.
- Add diff preview and one-click Apply Fix.

## Phase 4 (Week 4): Hardening + Release Candidate
- End-to-end validation and regression tests.
- Performance tuning for large files.
- Telemetry and structured logs.
