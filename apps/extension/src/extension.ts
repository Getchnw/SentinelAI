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

type ScanMode = "selection" | "full";

async function runScanForEditor(
  context: vscode.ExtensionContext,
  editor: vscode.TextEditor,
  selectionRange: vscode.Range,
  mode: ScanMode = "selection"
): Promise<void> {
  const selected = editor.document.getText(selectionRange);
  const isFullScan = mode === "full";

  const loadingResponse = {
    request_id: "",
    status: "idle",
    findings: [],
    original_code: "",
    fixed_code: "",
    explanation: isFullScan
      ? "Running full-file scan..."
      : "Refreshing current selection analysis...",
    timings_ms: {},
    errors: [],
  };

  showResultPanel(context, loadingResponse, {
    onApplyFix: async () => {
      vscode.window.showWarningMessage("Waiting for scan results...");
    },
    onRefresh: async () => {
      await runScanForEditor(context, editor, selectionRange, "selection");
    },
    onFullScan: async () => {
      const refreshedEditor = editor;
      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        refreshedEditor.document.lineAt(refreshedEditor.document.lineCount - 1).range.end
      );

      await runScanForEditor(context, refreshedEditor, fullRange, "full");
    },
  });

  const result = await scanAndFix(editor.document, selected, {
    retries: isFullScan ? 2 : 1,
    timeoutMs: isFullScan ? 240_000 : 120_000,
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
      await runScanForEditor(context, editor, selectionRange, "selection");
    },
    onFullScan: async () => {
      const refreshedEditor = editor;
      const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        refreshedEditor.document.lineAt(refreshedEditor.document.lineCount - 1).range.end
      );

      await runScanForEditor(context, refreshedEditor, fullRange, "full");
    },
  });

  vscode.window.showInformationMessage(
    isFullScan ? "SentinelAI full-file scan complete." : "SentinelAI refresh complete for selected range."
  );
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