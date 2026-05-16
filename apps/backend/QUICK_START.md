# SentinelAI Backend - Quick Reference Guide

## API Endpoint

```
POST /v1/scan-fix
```

## Request Format

```json
{
  "request_id": "unique-id",
  "language": "python|javascript|typescript|java|go|csharp|...",
  "file_path": "/path/to/file.py",
  "code_snippet": "your code here",
  "user_instruction": "optional guidance for AI"
}
```

## Response Format

### Success (status: "ok")
- **HTTP**: 200 OK
- **findings**: Array of vulnerabilities
- **fixed_code**: AI-generated secure code
- **explanation**: Why and how it was fixed
- **errors**: Empty array (or optional non-critical warnings)

### Partial Success (status: "partial_success")
- **HTTP**: 200 OK
- **findings**: Vulnerabilities detected
- **fixed_code**: Empty (fix generation failed)
- **explanation**: "Found N vulnerabilities but failed to generate fixes"
- **errors**: Array with LLM error details

### Error (status: "error")
- **HTTP**: 400 Bad Request (validation) or 500 Internal Server Error
- **findings**: Empty array
- **fixed_code**: Empty string
- **explanation**: Error message
- **errors**: Array with error details

## Error Handling Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ REQUEST RECEIVED                                            │
├─────────────────────────────────────────────────────────────┤
│ ↓                                                           │
│ [1] INPUT VALIDATION                                        │
│     ├─ Code not empty?                                     │
│     ├─ Code size < 1 MB?                                   │
│     ├─ Valid characters?                                   │
│     ├─ Language supported?                                 │
│     └─ Errors → HTTP 400                                   │
│ ↓                                                           │
│ [2] CODE SANITIZATION                                       │
│     ├─ Detect & mask secrets                               │
│     └─ Errors → HTTP 500                                   │
│ ↓                                                           │
│ [3] SEMGREP SCANNING (20s timeout)                         │
│     ├─ Run security analysis                               │
│     ├─ Parse JSON results                                  │
│     ├─ Timeout → HTTP 504                                  │
│     ├─ Execution failed → HTTP 500                         │
│     └─ Continue even with partial errors                   │
│ ↓                                                           │
│ [4] NO VULNERABILITIES?                                     │
│     └─ YES → Return 200 OK with empty findings             │
│ ↓                                                           │
│ [5] LLM FIX GENERATION                                      │
│     ├─ Connection error → HTTP 200 partial_success         │
│     ├─ Timeout error → HTTP 200 partial_success            │
│     ├─ Auth error → HTTP 200 partial_success               │
│     ├─ Rate limit → HTTP 200 partial_success               │
│     ├─ JSON parse error → HTTP 200 partial_success         │
│     └─ Success → Continue                                  │
│ ↓                                                           │
│ [6] DESANITIZATION                                          │
│     ├─ Restore secrets in fixed code                       │
│     └─ Log non-critical errors if needed                   │
│ ↓                                                           │
│ [7] RETURN HTTP 200 OK with full results                   │
└─────────────────────────────────────────────────────────────┘
```

## Common Error Scenarios

### 1. Empty Code
```json
{
  "status": "error",
  "explanation": "Code snippet cannot be empty",
  "errors": [{"source": "validation", "code": "INVALID_INPUT"}]
}
```
**Fix**: Provide non-empty code snippet

### 2. Unsupported Language
```json
{
  "status": "error",
  "explanation": "Language 'xyz' is not supported. Supported: ...",
  "errors": [{"source": "validation", "code": "INVALID_INPUT"}]
}
```
**Fix**: Use supported language (python, javascript, java, etc.)

### 3. Semgrep Timeout
```json
{
  "status": "error",
  "explanation": "Vulnerability scanning timed out...",
  "errors": [{"source": "semgrep", "code": "TIMEOUT"}]
}
```
**Fix**: Try with smaller code snippet or increase timeout

### 4. AI Generation Failed (but found vulnerabilities)
```json
{
  "status": "partial_success",
  "findings": [...],
  "fixed_code": "",
  "explanation": "Found 3 vulnerabilities but failed to generate fixes: ...",
  "errors": [{"source": "llm", "code": "GENERATION_FAILED"}]
}
```
**Note**: Still shows vulnerabilities even if fixes failed

### 5. Code Size Limit
```json
{
  "status": "error",
  "explanation": "Code snippet exceeds maximum size (1 MB)",
  "errors": [{"source": "validation", "code": "INVALID_INPUT"}]
}
```
**Fix**: Split code into smaller snippets

## Testing

### Quick Health Check
```bash
curl http://localhost:8000/v1/health
```

### Test Valid Scan
```bash
python test_api.py
```

### Test Specific Endpoint
```bash
curl -X POST http://localhost:8000/v1/scan-fix \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-1",
    "language": "python",
    "file_path": "test.py",
    "code_snippet": "x = input(); query = f\"SELECT * FROM t WHERE id={x}\""
  }'
```

## Supported Languages & Aliases

| Language | Aliases |
|----------|---------|
| Python | `python`, `py` |
| JavaScript | `javascript`, `js` |
| TypeScript | `typescript`, `ts` |
| Java | `java` |
| Go | `go` |
| C# | `csharp`, `cs`, `c#` |
| PHP | `php` |
| Ruby | `ruby`, `rb` |
| C++ | `cpp`, `c++` |
| C | `c` |

## Configuration

### LLM Configuration (Ollama)
```bash
# Default model (code-focused)
LLM_MODEL=ollama/qwen2.5-coder:7b

# Alternative models
LLM_MODEL=ollama/llama3.1
LLM_MODEL=ollama/mistral
LLM_MODEL=ollama/neural-chat

# Ollama API endpoint (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434
```

### How to Install Ollama

1. Visit https://ollama.ai
2. Download and install for your OS
3. Start Ollama: `ollama serve`
4. Pull model: `ollama pull qwen2.5-coder:7b` (or your preferred model)

### Semgrep Timeout
Edit `app/services/semgrep_runner.py`:
- Default: 20 seconds
- Increase for large files
- Decrease for faster failures

## Performance Metrics

All responses include `timings_ms`:
```json
{
  "timings_ms": {
    "semgrep": 250,  // Vulnerability scanning time
    "llm": 3500      // AI fix generation time
  }
}
```

## See Also

- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Comprehensive error guide
- [README.md](./README.md) - Full documentation
- [Architecture](../docs/ARCHITECTURE.md)
