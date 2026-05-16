# Error Handling Guide for SentinelAI Backend

## Overview

The SentinelAI Backend implements comprehensive error handling across all stages of the code scanning pipeline. This document explains how errors are handled and what responses to expect.

## Pipeline Stages and Error Handling

### 1. Input Validation (`validate_code_snippet`, `validate_language`)

**Purpose**: Ensure code snippet and language are valid before processing.

**Errors Caught**:
- **Empty or whitespace-only code**: `ValueError`
- **Code size > 1 MB**: `ValueError`
- **Invalid control characters in code**: `ValueError`
- **Missing or invalid language specification**: `ValueError`
- **Unsupported programming language**: `ValueError`

**Response Status**: `400 Bad Request`
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
      "detail": "Code snippet cannot be empty"
    }
  ]
}
```

### 2. Code Sanitization

**Purpose**: Remove secrets (API keys, passwords, etc.) before scanning.

**Errors Caught**:
- **File I/O errors**: `Exception`
- **Memory issues during sanitization**: `Exception`

**Response Status**: `500 Internal Server Error`
```json
{
  "request_id": "req-123",
  "status": "error",
  "explanation": "Failed to sanitize code",
  "errors": [
    {
      "source": "sanitizer",
      "code": "SANITIZATION_FAILED",
      "detail": "..."
    }
  ]
}
```

### 3. Semgrep Scanning

**Purpose**: Run static analysis to find vulnerabilities.

**Errors Caught**:

#### a) Unsupported Language
```
RuntimeError: Unsupported language: 'xyz'
```
**Response Status**: `400 Bad Request`

#### b) Semgrep Not Installed
```
RuntimeError: Semgrep scanner is not installed
```
**Response Status**: `500 Internal Server Error`

#### c) Semgrep Timeout
- Default timeout: **20 seconds**
- Can be configured in `semgrep_runner.py`

**Error Response**:
```json
{
  "request_id": "req-123",
  "status": "error",
  "explanation": "Vulnerability scanning timed out. The code snippet might be too large.",
  "timings_ms": {"semgrep": 20000, "llm": 0},
  "errors": [
    {
      "source": "semgrep",
      "code": "TIMEOUT",
      "detail": "Semgrep scan exceeded 20 seconds timeout..."
    }
  ]
}
```

**Handling**: 
- Increase timeout value if you have large code snippets
- Check code syntax validity
- Consider breaking large files into smaller parts

#### d) Semgrep Execution Failure
- Invalid syntax in code
- Unsupported code patterns
- System resource issues

**Error Response**:
```json
{
  "request_id": "req-123",
  "status": "error",
  "explanation": "Vulnerability scanner failed. This may be due to invalid syntax.",
  "errors": [
    {
      "source": "semgrep",
      "code": "EXECUTION_FAILED",
      "detail": "..."
    }
  ]
}
```

#### e) Invalid JSON Output from Semgrep
```
RuntimeError: Semgrep returned invalid JSON: ...
```

### 4. Finding Parsing

**Purpose**: Convert Semgrep results into Finding objects.

**Errors Caught**:
- **Missing required fields in finding**: `Exception`
- **Invalid field values**: `Exception`

**Handling**: Non-critical findings are skipped with a warning logged. The response includes partial errors:
```json
{
  "status": "ok or partial_success",
  "errors": [
    {
      "source": "parser",
      "code": "FINDING_PARSE_ERROR",
      "detail": "Could not parse finding: ..."
    }
  ]
}
```

### 5. LLM Fix Generation

**Purpose**: Use AI to generate fixes for vulnerabilities.

**Timeout**:
- Configured in `llm_client.py`
- Default varies by LLM provider

**Errors Caught**:

#### a) LLM Timeout
```
RuntimeError: AI engine timed out while generating fixes
```

#### b) Connection Error
```
RuntimeError: Cannot connect to Ollama at localhost:11434. 
Please make sure Ollama is running: ollama serve
```

#### c) Model Not Found
```
RuntimeError: Model 'llama3.1' not found. Pull it first: ollama pull llama3.1
```

#### d) Timeout Error
```
RuntimeError: Ollama generation timed out while generating fixes. Try with simpler code.
```

#### e) Invalid JSON Response
```
RuntimeError: Ollama returned an unexpected format. The response was not valid JSON.
```

**Response Status**: `200 OK` with `status: "partial_success"`
```json
{
  "request_id": "req-123",
  "status": "partial_success",
  "findings": [...],  // Vulnerabilities found
  "fixed_code": "",   // Empty because generation failed
  "explanation": "⚠ Found 3 vulnerabilities but failed to generate fixes: ...",
  "timings_ms": {"semgrep": 150, "llm": 5000},
  "errors": [
    {
      "source": "llm",
      "code": "GENERATION_FAILED",
      "detail": "..."
    }
  ]
}
```

**Important Note**: Even if LLM fails, the endpoint returns the findings. This allows users to see what vulnerabilities were detected, even if fixes couldn't be generated.

### 6. Code Desanitization

**Purpose**: Restore secrets in the fixed code.

**Errors Caught**:
- **Memory issues**: `Exception`
- **Token mapping failures**: `Exception`

**Handling**: Non-critical error. Returns fixed code without restored secrets and logs the error:
```json
{
  "status": "ok",
  "errors": [
    {
      "source": "sanitizer",
      "code": "DESANITIZATION_FAILED",
      "detail": "..."
    }
  ]
}
```

## HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| `200 OK` | Scan completed successfully | All findings processed, fixes generated |
| `400 Bad Request` | Invalid input | Bad code format, unsupported language, empty code |
| `500 Internal Server Error` | Server error | Sanitizer failed, Semgrep crashed, system issues |
| `504 Gateway Timeout` | Semgrep timeout | Scan took too long |

## Success Response

```json
{
  "request_id": "req-123",
  "status": "ok",
  "findings": [
    {
      "rule_id": "python.django.security.injection.sql_injection",
      "severity": "critical",
      "message": "User input directly used in SQL query",
      "start_line": 5,
      "end_line": 5
    }
  ],
  "fixed_code": "# Fixed code here",
  "explanation": "Root cause analysis and fix explanation",
  "timings_ms": {
    "semgrep": 150,
    "llm": 2500
  },
  "errors": []
}
```

## No Vulnerabilities Response

```json
{
  "request_id": "req-123",
  "status": "ok",
  "findings": [],
  "fixed_code": "# Original code returned",
  "explanation": "✓ No vulnerabilities detected. Your code looks secure!",
  "timings_ms": {
    "semgrep": 120,
    "llm": 0
  },
  "errors": []
}
```

## Supported Languages

The backend supports the following programming languages:

- **Python**: `.py`, `python`, `py`
- **JavaScript**: `.js`, `javascript`, `js`
- **TypeScript**: `.ts`, `typescript`, `ts`
- **Java**: `.java`, `java`
- **Go**: `.go`, `go`
- **C#**: `.cs`, `csharp`, `c#`, `cs`
- **PHP**: `.php`, `php`
- **Ruby**: `.rb`, `ruby`
- **C++**: `.cpp`, `c++`, `cpp`
- **C**: `.c`, `c`

## Configuration

### Environment Variables

```bash
# LLM Configuration (Ollama - Local)
LLM_MODEL=ollama/llama3.1

# Ollama API endpoint (default: http://localhost:11434)
OLLAMA_URL=http://localhost:11434

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

### Timeout Configuration

Edit `app/services/semgrep_runner.py`:
```python
def run_semgrep(code: str, language: str, timeout_seconds: int = 20):
    # Change default timeout from 20 to your desired value
```

## Debugging

### Enable Debug Logging

Set environment variable:
```bash
LOG_LEVEL=DEBUG
```

Then check logs for detailed information about each pipeline stage.

### Common Issues

#### 1. "Semgrep not found"
**Solution**: Install Semgrep
```bash
pip install semgrep
# or
brew install semgrep
# or
choco install semgrep
```

#### 2. "Cannot connect to Ollama"
**For Ollama**:
```bash
# Start Ollama service
ollama serve

# Check available models
ollama list

# Pull a model if needed
ollama pull llama3.1

# Test connection
curl http://localhost:11434/api/tags
```

#### 3. "Scan exceeded timeout"
**Solution**: Either
- Increase `timeout_seconds` parameter
- Break large files into smaller chunks
- Optimize code for faster analysis (remove large strings, etc.)

#### 4. "Code contains invalid control characters"
**Cause**: Your code contains invalid UTF-8 or control characters
**Solution**: Ensure your code is valid UTF-8 encoded text

## Testing the API

### Test with curl

#### Successful scan:
```bash
curl -X POST http://localhost:8000/v1/scan-fix \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-123",
    "language": "python",
    "file_path": "test.py",
    "code_snippet": "import os\npassword = os.getenv(\"DB_PASSWORD\")\nquery = f\"SELECT * FROM users WHERE id={user_id}\""
  }'
```

#### Validation error (empty code):
```bash
curl -X POST http://localhost:8000/v1/scan-fix \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-123",
    "language": "python",
    "file_path": "test.py",
    "code_snippet": ""
  }'
```

#### Unsupported language:
```bash
curl -X POST http://localhost:8000/v1/scan-fix \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-123",
    "language": "cobol",
    "file_path": "test.cbl",
    "code_snippet": "DISPLAY \"Hello World\"."
  }'
```

## See Also

- [Main README](./README.md)
- [Architecture](../docs/ARCHITECTURE.md)
- [Backend Setup](./app/README.md)
