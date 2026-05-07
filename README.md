# SentinelAI

In the era of AI-assisted coding, developers face two major challenges:

## 1) Security Debt
- Identifying vulnerabilities in code is time-consuming and complex.
- Developers often struggle to find correct and secure fixes.

## 2) Data Leakage Risk
- Source code may contain sensitive data such as API keys, passwords, and personal information.
- Sending raw code to AI services can increase the risk of data leakage.

## Solution

### Vulnerability Scanner
- Uses industry-standard tools such as Semgrep to detect common vulnerabilities.

### Secret Detection and Redaction (Privacy Shield)
- Automatically scans for sensitive data before code leaves the local environment or server.
- Applies data redaction by replacing sensitive values with placeholders.

### AI Fix Engine
- Sends sanitized code context (after redaction) to OpenAI for analysis.
- AI provides:
  - Root cause explanation
  - Recommended fix
  - Secure code snippet

### Developer Tools
- VS Code:
  - Real-time vulnerability alerts
  - One-click "Fix with AI" directly in the editor

## How to Use

### Prerequisites
- Python 3.11+
- Node.js 20+
- Ollama running locally with qwen2.5-coder:7b model (or other model)
- VS Code 1.95+

### 1. Start Backend API (FastAPI)
1. Open terminal in apps/backend
2. Create virtual environment: python -m venv ../../.venv
3. Activate virtual environment (PowerShell): ../../.venv/Scripts/Activate.ps1
4. Install packages: python -m pip install -r requirements.txt
5. Run server: python -m uvicorn app.main:app --port 8000
6. Verify health endpoint: GET http://127.0.0.1:8000/v1/health

PowerShell quick script:

```powershell
Set-Location apps/backend
python -m venv ../../.venv
../../.venv/Scripts/Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

### 2. Start VS Code Extension
1. Open the repository root folder SentinelAI in VS Code
2. Install dependencies in apps/extension: npm install
3. Build extension: npm run build
4. Open Run and Debug and select Run SentinelAI Extension
5. Press F5 to launch Extension Development Host

PowerShell quick script:

```powershell
Set-Location apps/extension
npm install
npm run build
```

If F5 opens a JSON debug prompt, use the root workspace debug profile at [.vscode/launch.json](.vscode/launch.json) and choose Run SentinelAI Extension instead of running the open file.

### 3. Run Scan and Apply Fix
1. Open a source file in the Extension Development Host
2. Select code snippet (or leave empty selection to scan full file)
3. Run command: SentinelAI: Scan and Suggest Fix
4. Review diagnostics in editor (warning/error highlights)
5. Open quick fix (lightbulb) and click SentinelAI: Apply Fix

### 4. QA Validation
1. Use sample vulnerable code in qa/testcases/owasp-top10
2. Confirm findings are detected at correct lines
3. Confirm fixed code removes vulnerability without breaking behavior

### 5. API Test Suite
Run this after backend is up (in another terminal):

```bash
cd apps/backend
python test_api.py
```

**Expected output:**
- Health check test
- Empty code validation test  
- Unsupported language error test
- Code size limit test
- Secure code scan (no vulnerabilities)
- Valid Python scan (SQL injection + hardcoded credentials)
- JavaScript code scan (XSS vulnerabilities)
- Test summary with [PASS]/[FAIL] status

### 6. Start Ollama (if not already running)
```bash
# Install Ollama from https://ollama.ai
# Then start Ollama service
ollama serve

# In another terminal, pull the default model
ollama pull qwen2.5-coder:7b

# Or use other models
ollama pull llama3.1
ollama pull mistral
ollama pull neural-chat
```

### 7. Quick Health Check
```bash
curl http://localhost:8000/v1/health
```

### 8. Manual Scan Test (Python with SQL Injection)
```bash
curl -X POST http://localhost:8000/v1/scan-fix \
  -H "Content-Type: application/json" \
  -d '{
    "request_id": "test-1",
    "language": "python",
    "file_path": "test.py",
    "code_snippet": "x = input()\nquery = f\"SELECT * FROM users WHERE id={x}\""
  }'
```

### 9. Configuration (Optional)
Default uses `ollama/qwen2.5-coder:7b`. To use a different model:

```bash
# Set the Ollama model
export LLM_MODEL=ollama/llama3.1
# or
export LLM_MODEL=ollama/mistral
# or
export LLM_MODEL=ollama/neural-chat

# Ollama URL (default: http://localhost:11434)
export OLLAMA_URL=http://localhost:11434
```

## Troubleshooting

- If SentinelAI: Scan and Suggest Fix does not appear, make sure the Extension Development Host was launched from the root workspace and the SentinelAI extension is built in apps/extension.
- If F5 opens JSON debugging instead of the extension, close that prompt and use the Run SentinelAI Extension profile from the root [.vscode/launch.json](.vscode/launch.json).
- If test_api.py fails with connection error, verify backend is running on http://localhost:8000
- If /scan-fix returns 500 with Ollama connection error, verify Ollama is running: `ollama serve`
- For semgrep errors, ensure semgrep is installed: `pip install semgrep`
- To check available Ollama models: `ollama list`

## Project Structure
- apps/backend: FastAPI gateway, sanitization, Semgrep, AI orchestration
- apps/extension: VS Code extension core, diagnostics, code actions
- apps/webview-ui: React UI for chat and diff-style result panel
- qa: security test cases and validation plan
- contracts: API schema between extension and backend
- docs: architecture and roadmap
