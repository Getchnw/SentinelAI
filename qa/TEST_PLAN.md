# QA and Security Test Plan

## Scope
Validate that SentinelAI:
- Detects vulnerabilities from OWASP-like snippets.
- Returns safe code suggestions.
- Preserves application behavior.
- Supports complete flow from scan command to Apply Fix.

## Test Matrix
- Unit: backend services (sanitizer, Semgrep parser, prompt builder).
- Integration: FastAPI + Semgrep + mock Ollama response.
- Extension: diagnostics rendering and quick fix action.
- E2E: open file in VS Code, run command, inspect diff, apply fix.

## Acceptance Criteria
- Vulnerable snippets are flagged with line-accurate diagnostics.
- Fixed code removes vulnerability pattern.
- No syntax break introduced by fix.
- End-to-end command completes under 70 seconds on local machine.
