import * as vscode from "vscode";
import type { Finding } from "../core/backendClient";

export const diagnosticCollection =
  vscode.languages.createDiagnosticCollection("sentinelai");

export function updateDiagnostics(
  document: vscode.TextDocument,
  findings: Finding[]
): void {
  const diagnostics = findings.map((finding) => {
    const start = new vscode.Position(Math.max(0, finding.start_line - 1), 0);
    const end = new vscode.Position(Math.max(0, finding.end_line - 1), 200);
    const severity =
      finding.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;

    return new vscode.Diagnostic(
      new vscode.Range(start, end),
      `[${finding.rule_id}] ${finding.message}`,
      severity
    );
  });

  diagnosticCollection.set(document.uri, diagnostics);
}
