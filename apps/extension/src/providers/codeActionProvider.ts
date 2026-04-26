import * as vscode from "vscode";

let fixedCodeCache = "";

export function setFixedCode(code: string): void {
  fixedCodeCache = code;
}

export class SentinelCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range
  ): vscode.CodeAction[] {
    if (!fixedCodeCache) {
      return [];
    }

    const action = new vscode.CodeAction(
      "SentinelAI: Apply Fix",
      vscode.CodeActionKind.QuickFix
    );

    action.edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      document.lineAt(document.lineCount - 1).range.end
    );
    action.edit.replace(document.uri, fullRange, fixedCodeCache);

    return [action];
  }
}
