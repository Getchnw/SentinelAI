# SentinelAI Extension Flow: UI Patch Test Cases

## File: `cmd_injection_python.py`

| Test Case ID | Title | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC_EXT_001** | Verify AI patch application for Command Injection | 1. VS Code is open with SentinelAI active.<br>2. `cmd_injection_python.py` is open in the active editor. | 1. Navigate to `cmd_injection_python.py` in the editor.<br>2. Wait for the SentinelAI engine to scan and highlight the vulnerable `subprocess` call (around line 6/7) with a diagnostic squiggle.<br>3. Hover over the diagnostic to reveal the Quick Fix (lightbulb) menu.<br>4. Click **"SentinelAI: Apply Fix"**. | 1. **UI Behavior:** The editor should smoothly apply the patch, replacing the shell string concatenation with a secure alternative (e.g., using `shlex.quote` or passing arguments as a list).<br>2. **Syntax & Formatting:** Python-specific structures, especially strict indentation rules, must be flawlessly preserved.<br>3. **File Integrity:** The rest of the file (imports, function signature, `if __name__ == "__main__":` block) must remain intact without truncation or unintended deletions. |

---

## File: `sqli_node_express.js`

| Test Case ID | Title | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC_EXT_002** | Verify AI patch application for SQL Injection | 1. VS Code is open with SentinelAI active.<br>2. `sqli_node_express.js` is open in the active editor. | 1. Navigate to `sqli_node_express.js` in the editor.<br>2. Wait for the SentinelAI engine to scan and highlight the vulnerable SQL query string concatenation (around line 11).<br>3. Hover over the diagnostic to reveal the Quick Fix (lightbulb) menu.<br>4. Click **"SentinelAI: Apply Fix"**. | 1. **UI Behavior:** The editor should inline the patch, replacing the concatenated string with a parameterized query (e.g., `SELECT * FROM users WHERE username = ?`) and updating the `db.all` arguments array.<br>2. **Syntax & Formatting:** JavaScript syntax, Express.js route callback structures, and closure formatting must be perfectly maintained.<br>3. **File Integrity:** No required modules (`express`, `sqlite3`), server initialization code, or the listening port block should be modified or lost. |

---

## File: `xss_react_component.jsx`

| Test Case ID | Title | Preconditions | Steps | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **TC_EXT_003** | Verify AI patch application for Cross-Site Scripting (XSS) | 1. VS Code is open with SentinelAI active.<br>2. `xss_react_component.jsx` is open in the active editor. | 1. Navigate to `xss_react_component.jsx` in the editor.<br>2. Wait for the SentinelAI engine to scan and highlight the `dangerouslySetInnerHTML` usage (around line 8).<br>3. Hover over the diagnostic to reveal the Quick Fix menu.<br>4. Click **"SentinelAI: Apply Fix"**. | 1. **UI Behavior:** The editor should seamlessly insert a sanitization layer (like `DOMPurify.sanitize(bioHtml)`) into the `dangerouslySetInnerHTML` prop or replace it with a safer alternative if applicable.<br>2. **Syntax & Formatting:** JSX-specific syntax (angle brackets, self-closing tags, curly braces for JS expressions) must be strictly preserved without breaking the component's render tree.<br>3. **File Integrity:** React imports and the `ProfileCard` component structure must remain entirely intact. |
