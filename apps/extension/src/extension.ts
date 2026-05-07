import * as vscode from "vscode";
import { scanAndFix } from "./core/backendClient";
import {
  clearDiagnostics,
  diagnosticCollection,
  updateDiagnostics,
} from "./providers/diagnosticProvider";
import {
  SentinelCodeActionProvider,
  applyLatestFix,
  clearScanResult,
  setScanResult,
} from "./providers/codeActionProvider";
import { showResultPanel } from "./webview/panel";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(diagnosticCollection);

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: "file" },
      new SentinelCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("sentinelai.scanCurrentSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor found.");
        return;
      }

      const selectionRange = editor.selection.isEmpty
        ? new vscode.Range(
            new vscode.Position(0, 0),
            editor.document.lineAt(editor.document.lineCount - 1).range.end
          )
        : new vscode.Range(editor.selection.start, editor.selection.end);
      
      const selected = editor.document.getText(selectionRange);

      try {
        // --- 1. ปิดการเรียก Backend ของจริงชั่วคราว ---
        /*
        const result = await scanAndFix(editor.document, selected, {
          retries: 1,
          timeoutMs: 30_000,
        });
        */

        // --- 2. จำลองเวลา AI คิด (ดีเลย์ 1.5 วินาที) ---
        await new Promise(resolve => setTimeout(resolve, 1500));

        // --- 3. สร้างข้อมูลจำลอง (Mock Data) สำหรับทำ UI ---
        const result = {
          request_id: "mock-123",
          status: "ok",
          findings: [
            {
              rule_id: "mock-sql-injection",
              severity: "error" as const,
              message: "Potential SQL Injection detected (Mock)",
              start_line: 1,
              end_line: 2
            }
          ],
          fixed_code: "def get_user(conn, user_input):\n    # 🛡️ นี่คือโค้ดจำลองที่ปลอดภัยแล้ว!\n    query = 'SELECT * FROM users WHERE username = ?'\n    return conn.execute(query, (user_input,))",
          explanation: "🚨 **พบช่องโหว่ SQL Injection** (ข้อความจำลองสำหรับจัด UI)\n\nการนำตัวแปร `user_input` ไปต่อ String ตรงๆ ทำให้เกิดช่องโหว่ แนะนำให้ใช้ Parameterized Query แทนครับ",
          timings_ms: { semgrep: 15, llm: 1200 },
          errors: []
        };

        // --- 4. ส่งข้อมูลเข้าสู่ระบบของ Extension ---
        updateDiagnostics(editor.document, result.findings, selectionRange.start.line);
        
        // @ts-ignore
        setScanResult(editor.document, selectionRange, result);
        
        // @ts-ignore
        showResultPanel(context, result, {
          onApplyFix: async () => {
            const applied = await applyLatestFix(editor.document.uri);
            if (!applied) {
              vscode.window.showWarningMessage(
                "SentinelAI fix is not available for the current document."
              );
            }
          },
        });
        
        vscode.window.showInformationMessage("SentinelAI scan complete (Mock Mode).");
      } catch (error) {
        clearDiagnostics(editor.document);
        clearScanResult(editor.document.uri);
        vscode.window.showErrorMessage(`SentinelAI failed: ${String(error)}`);
      }
    })
  );
}

export function deactivate(): void {}