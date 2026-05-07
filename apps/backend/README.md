# apps/backend

Backend service for SentinelAI - FastAPI server that handles vulnerability scanning and AI-powered code fixing.

## What this folder contains

- `app/`: FastAPI application code, models, API routes, and services
  - `main.py`: FastAPI app initialization
  - `models.py`: Pydantic models for request/response
  - `api/routes.py`: API endpoints with comprehensive error handling
  - `services/`:
    - `semgrep_runner.py`: Vulnerability scanning engine
    - `llm_client.py`: AI fix generation service
    - `sanitizer.py`: Secret detection and redaction
- `tests/`: Backend tests
- `requirements.txt`: Python dependencies
- `ERROR_HANDLING.md`: Comprehensive error handling guide

## Quick Start

### 1. Install Dependencies
```bash
cd apps/backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables (Optional)

Create a `.env` file (optional, defaults provided):
```bash
# LLM Configuration (Ollama - local)
# Default: ollama/qwen2.5-coder:7b (code-focused model)
LLM_MODEL=ollama/qwen2.5-coder:7b

# Ollama API endpoint (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Logging
LOG_LEVEL=INFO
```

### 3. Start Backend Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```http
GET /v1/health
```

Response:
```json
{"status": "ok"}
```

### Scan & Fix Code
```http
POST /v1/scan-fix
Content-Type: application/json

{
  "request_id": "unique-request-id",
  "language": "python",
  "file_path": "src/app.py",
  "code_snippet": "# Your code here",
  "user_instruction": "Focus on SQL injection prevention"  // optional
}
```

## Response Format

### Success (200 OK)
```json
{
  "request_id": "req-123",
  "status": "ok",
  "findings": [
    {
      "rule_id": "python.django.security.injection.sql_injection",
      "severity": "critical",
      "message": "User input directly used in SQL query",
      "start_line": 10,
      "end_line": 10
    }
  ],
  "fixed_code": "# Secure version of the code",
  "explanation": "The vulnerability was caused by...",
  "timings_ms": {
    "semgrep": 250,
    "llm": 3500
  },
  "errors": []
}
```

### Validation Error (400 Bad Request)
```json
{
  "request_id": "req-123",
  "status": "error",
  "findings": [],
  "fixed_code": "",
  "explanation": "Code snippet cannot be empty",
  "timings_ms": {"semgrep": 0, "llm": 0},
  "errors": [
    {
      "source": "validation",
      "code": "INVALID_INPUT",
      "detail": "..."
    }
  ]
}
```

### Partial Success (200 OK)
If scanning succeeds but fix generation fails:
```json
{
  "request_id": "req-123",
  "status": "partial_success",
  "findings": [...],
  "fixed_code": "",
  "explanation": "⚠ Found 3 vulnerabilities but failed to generate fixes: ...",
  "errors": [
    {
      "source": "llm",
      "code": "GENERATION_FAILED",
      "detail": "..."
    }
  ]
}
```

## Supported Languages

Python, JavaScript, TypeScript, Java, Go, C#, PHP, Ruby, C, C++

See [ERROR_HANDLING.md](./ERROR_HANDLING.md) for complete language list and aliases.

## LLM Configuration

This backend uses **Ollama** for local AI-powered code fixes.

### Setup Ollama

1. **Install Ollama** from https://ollama.ai
2. **Start Ollama service**:
   ```bash
   ollama serve
   ```
3. **Pull the default model** (code-focused):
   ```bash
   ollama pull qwen2.5-coder:7b
   ```

### Available Models

- `qwen2.5-coder:7b` - Fast, code-focused model (default)
- `llama3.1` - Capable general-purpose model
- `mistral` - Efficient model
- `neural-chat` - Conversational model
- `codegemma` - Code-focused model

### Change LLM Model

```bash
# Set environment variable
export LLM_MODEL=ollama/llama3.1

# Or create .env file
echo "LLM_MODEL=ollama/llama3.1" >> .env
```

### Ollama URL Configuration

```bash
# Default is http://localhost:11434
# Set custom URL if Ollama runs on different host/port
export OLLAMA_URL=http://your-server:11434
```

## Responsibilities

✅ Accept requests from the VS Code extension
✅ Validate and normalize code input with comprehensive error handling
✅ Run secret redaction (detect-secrets) before scanning
✅ Execute Semgrep scanning with timeout protection
✅ Send sanitized context to the AI engine (Ollama - local LLM via litellm)
✅ Return findings, fixed code, and detailed errors
✅ Handle partial failures gracefully (e.g., scanning succeeds but fixing fails)

## Error Handling

The backend implements a robust error handling pipeline:

1. **Input Validation**: Checks code format, size, and language support
2. **Sanitization**: Removes secrets before processing
3. **Semgrep Scanning**: Runs with timeout and error recovery
4. **Finding Parsing**: Gracefully handles malformed results
5. **LLM Fix Generation**: Catches timeouts, auth errors, and parsing failures
6. **Desanitization**: Safely restores secrets in fixed code

**All errors include detailed error objects with source, code, and description.**

👉 See [ERROR_HANDLING.md](./ERROR_HANDLING.md) for detailed error handling documentation.

## Configuration

### Semgrep Timeout
Edit `app/services/semgrep_runner.py`:
```python
def run_semgrep(code: str, language: str, timeout_seconds: int = 20):
```

### LLM Provider
Configured via environment variables:
```bash
# Ollama (Local LLM - Current Setup)
LLM_MODEL=ollama/llama3.1

# Ollama API endpoint (default)
OLLAMA_URL=http://localhost:11434
```

The backend uses `litellm` library which supports Ollama for local LLM inference.

## VS Code Integration

The VS Code extension sends code to this backend via:
```typescript
// From extension.ts or webview
const response = await fetch('http://localhost:8000/v1/scan-fix', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request_id: generateRequestId(),
    language: 'python',
    file_path: '/path/to/file.py',
    code_snippet: selectedCode
  })
});
```

## Troubleshooting

### Semgrep Not Found
```bash
pip install semgrep
which semgrep
```

### AI Provider Connection Issues
Check your `LLM_MODEL` and API configuration:
```bash
# For Ollama
curl http://localhost:11434/api/tags

# For OpenAI
echo $OPENAI_API_KEY | wc -c  # Should be 48+ chars
```

### Slow Scanning
- Increase `timeout_seconds` in Semgrep configuration
- Break large files into smaller snippets
- Check available system memory

### LLM Generation Failures
- Verify LLM provider is running/accessible
- Check API credentials
- Try with a simpler code snippet

## Testing

Run the health check:
```bash
curl http://localhost:8000/v1/health
```

Test the scan endpoint:
```bash
curl -X POST http://localhost:8000/v1/scan-fix \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-1",
    "language": "python",
    "file_path": "test.py",
    "code_snippet": "import os\npassword = input()"
  }'
```

## Dependencies

- **fastapi**: Web framework
- **pydantic**: Data validation
- **semgrep**: Static analysis engine
- **detect-secrets**: Secret detection
- **litellm**: Multi-provider LLM interface
- **httpx**: Async HTTP client

See `requirements.txt` for exact versions.
