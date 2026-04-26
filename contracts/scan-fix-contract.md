# Scan and Fix Contract

## POST /v1/scan-fix

Request:
- request_id: string (uuid recommended)
- language: string (python|javascript|typescript|java|go|csharp)
- file_path: string
- code_snippet: string
- user_instruction: string (optional)

Response:
- request_id: string
- status: string (ok|partial|error)
- findings: array
  - rule_id: string
  - severity: string (info|warning|error)
  - message: string
  - start_line: number
  - end_line: number
- fixed_code: string
- explanation: string
- timings_ms:
  - semgrep: number
  - llm: number
- errors: array (optional)
  - source: string (validation|semgrep|llm|system)
  - code: string
  - detail: string
