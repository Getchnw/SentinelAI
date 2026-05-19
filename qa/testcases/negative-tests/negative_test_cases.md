# SentinelAI: Negative & Error Handling Test Cases

## Scenario 1: Syntax Error File

| Test Case ID | Title | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC_NEG_001** | Handle broken syntax gracefully | 1. VS Code is open with SentinelAI active.<br>2. A Python file (`syntax_error.py`) containing deliberate, severe syntax errors is open. | 1. Open `syntax_error.py` in the active editor.<br>2. Manually trigger the SentinelAI vulnerability scan (or wait for auto-scan). | **Graceful Handling:** The extension should detect the parsing failure and abort the scan gracefully. It must display a clear, user-friendly error notification (e.g., *"SentinelAI: Unable to scan file due to syntax errors. Please fix syntax issues and try again."*) instead of crashing, hanging, or generating nonsensical security diagnostics. |

---

## Scenario 2: AI Timeout/Offline

| Test Case ID | Title | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC_NEG_002** | Handle offline AI engine / Connection Timeout | 1. VS Code is open with SentinelAI active.<br>2. The local AI engine (e.g., Ollama server or backend API) is intentionally stopped or disconnected. | 1. Open a valid source file with a known vulnerability.<br>2. Trigger the SentinelAI scan or attempt to click "Apply Fix" from a previous diagnostic.<br>3. Wait for the network request to attempt a connection. | **Graceful Handling:** The extension must catch the connection failure or HTTP 500/503 error. It should display a clear, actionable UI toast notification (e.g., *"SentinelAI: Connection failed. Please ensure the local AI server is running."*) and stop the loading spinner. It must **not** fail silently, hang indefinitely, or crash the VS Code extension host. |

---

## Scenario 3: Unsupported Language

| Test Case ID | Title | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC_NEG_003** | Prevent scanning of unsupported file types | 1. VS Code is open with SentinelAI active.<br>2. A plain text file (`notes.txt`) or an explicitly unsupported language file is open. | 1. Open `notes.txt` in the active editor.<br>2. Attempt to trigger the SentinelAI vulnerability scan via command palette or shortcut. | **Graceful Handling:** The extension should immediately validate the language ID and refuse the scan. It must either disable the command or display an immediate user-friendly notification (e.g., *"SentinelAI: Scanning is not supported for plain text files."*). It must not send the file to the backend, preventing unnecessary network payloads and potential backend parser crashes. |
