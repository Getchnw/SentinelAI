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
        const result = await scanAndFix(editor.document, selected, {
          retries: 1,
          timeoutMs: 30_000,
        });

        updateDiagnostics(editor.document, result.findings, selectionRange.start.line);
        setScanResult(editor.document, selectionRange, result);
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
        vscode.window.showInformationMessage("SentinelAI scan complete.");
      } catch (error) {
        clearDiagnostics(editor.document);
        clearScanResult(editor.document.uri);
        vscode.window.showErrorMessage(`SentinelAI failed: ${String(error)}`);
      }
    })
  );
}

export function deactivate(): void {}
