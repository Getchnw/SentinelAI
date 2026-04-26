import * as vscode from "vscode";
import { scanAndFix } from "./core/backendClient";
import { updateDiagnostics, diagnosticCollection } from "./providers/diagnosticProvider";
import { SentinelCodeActionProvider, setFixedCode } from "./providers/codeActionProvider";
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

      const selected = editor.selection.isEmpty
        ? editor.document.getText()
        : editor.document.getText(editor.selection);

      try {
        const result = await scanAndFix(editor.document, selected);
        updateDiagnostics(editor.document, result.findings);
        setFixedCode(result.fixed_code);
        showResultPanel(result.explanation);
        vscode.window.showInformationMessage("SentinelAI scan complete.");
      } catch (error) {
        vscode.window.showErrorMessage(`SentinelAI failed: ${String(error)}`);
      }
    })
  );
}

export function deactivate(): void {}
