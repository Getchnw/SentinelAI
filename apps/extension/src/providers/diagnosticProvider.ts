import * as vscode from "vscode";
import type { Finding } from "../core/backendClient";

export const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("sentinelai");

function clampLine(document: vscode.TextDocument, lineNumber: number): number {
  return Math.min(Math.max(0, lineNumber), Math.max(0, document.lineCount - 1));
}

export function updateDiagnostics(
  document: vscode.TextDocument,
  findings: Finding[],
  lineOffset = 0
): void {
  const diagnostics = findings.map((finding) => {
    const startLine = clampLine(document, lineOffset + finding.start_line - 1);
    const endLine = clampLine(document, lineOffset + finding.end_line - 1);
    const start = new vscode.Position(startLine, 0);
    const end = document.lineAt(endLine).range.end;
    const severity =
      finding.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : finding.severity === "info"
          ? vscode.DiagnosticSeverity.Information
        : vscode.DiagnosticSeverity.Warning;

    return new vscode.Diagnostic(
      new vscode.Range(start, end),
      `[${finding.rule_id}] ${finding.message}`,
      severity
    );
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

export function clearDiagnostics(document: vscode.TextDocument): void {
  diagnosticCollection.delete(document.uri);
}
