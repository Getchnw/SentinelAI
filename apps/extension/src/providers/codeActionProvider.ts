import * as vscode from "vscode";
import type { ScanFixResponse } from "../core/backendClient";

type ScanState = {
  selectionRange: vscode.Range;
  response: ScanFixResponse;
};

const scanStateByDocument = new Map<string, ScanState>();

export function setScanResult(
  document: vscode.TextDocument,
  selectionRange: vscode.Range,
  response: ScanFixResponse
): void {
  scanStateByDocument.set(document.uri.toString(), {
    selectionRange,
    response,
  });
}

export function clearScanResult(documentUri: vscode.Uri): void {
  scanStateByDocument.delete(documentUri.toString());
}

export async function applyLatestFix(
  documentUri?: vscode.Uri
): Promise<boolean> {
  const editor = vscode.window.activeTextEditor;

  if (!editor && !documentUri) {
    return false;
  }

  const targetUri = documentUri ?? editor!.document.uri;
  const state = scanStateByDocument.get(targetUri.toString());

  if (!state) {
    return false;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.replace(targetUri, state.selectionRange, state.response.fixed_code);
  return vscode.workspace.applyEdit(workspaceEdit);
}

export class SentinelCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const state = scanStateByDocument.get(document.uri.toString());

    if (!state) {
      return [];
    }

    if (range.intersection(state.selectionRange) === undefined && context.diagnostics.length === 0) {
      return [];
    }

    const action = new vscode.CodeAction(
      "SentinelAI: Apply Fix",
      vscode.CodeActionKind.QuickFix
    );

    action.edit = new vscode.WorkspaceEdit();
    action.edit.replace(document.uri, state.selectionRange, state.response.fixed_code);
    action.isPreferred = true;

    return [action];
  }
}
