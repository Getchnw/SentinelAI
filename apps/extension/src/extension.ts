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

async function runScanForEditor(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  selectionRange: vscode.Range
): Promise<void> {
  const selected = editor.document.getText(selectionRange);

  const loadingResponse = {
    request_id: "",
    status: "idle",
    findings: [],
    fixed_code: "",
    explanation: "Scanning...",
    timings_ms: {},
    errors: [],
  };

  showResultPanel(context, loadingResponse, {
    onApplyFix: async () => {
      vscode.window.showWarningMessage("Waiting for scan results...");
    },
    onRefresh: async () => {
      const refreshedEditor = vscode.window.activeTextEditor;
      if (!refreshedEditor) {
        return;
      }

      const refreshedSelection = refreshedEditor.selection.isEmpty
        ? new vscode.Range(
            new vscode.Position(0, 0),
            refreshedEditor.document.lineAt(refreshedEditor.document.lineCount - 1).range.end
          )
        : new vscode.Range(refreshedEditor.selection.start, refreshedEditor.selection.end);

      await runScanForEditor(context, refreshedEditor, refreshedSelection);
    },
    onFullScan: async () => {
      const refreshedEditor = vscode.window.activeTextEditor;
      if (!refreshedEditor) {
        return;
      }

      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        refreshedEditor.document.lineAt(refreshedEditor.document.lineCount - 1).range.end
      );

      await runScanForEditor(context, refreshedEditor, fullRange);
    },
  });

  const result = await scanAndFix(editor.document, selected, {
    retries: 1,
    timeoutMs: 60_000,
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
    onRefresh: async () => {
      const refreshedEditor = vscode.window.activeTextEditor;
      if (!refreshedEditor) {
        return;
      }

      const refreshedSelection = refreshedEditor.selection.isEmpty
        ? new vscode.Range(
            new vscode.Position(0, 0),
            refreshedEditor.document.lineAt(refreshedEditor.document.lineCount - 1).range.end
          )
        : new vscode.Range(refreshedEditor.selection.start, refreshedEditor.selection.end);

      await runScanForEditor(context, refreshedEditor, refreshedSelection);
    },
    onFullScan: async () => {
      const refreshedEditor = vscode.window.activeTextEditor;
      if (!refreshedEditor) {
        return;
      }

      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        refreshedEditor.document.lineAt(refreshedEditor.document.lineCount - 1).range.end
      );

      await runScanForEditor(context, refreshedEditor, fullRange);
    },
  });

  vscode.window.showInformationMessage("SentinelAI scan complete.");
}

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

      try {
        await runScanForEditor(context, editor, selectionRange);
      } catch (error) {
        clearDiagnostics(editor.document);
        clearScanResult(editor.document.uri);
        vscode.window.showErrorMessage(`SentinelAI failed: ${String(error)}`);
      }
    })
  );
}

export function deactivate(): void {}