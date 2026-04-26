import * as vscode from "vscode";

export type Finding = {
  rule_id: string;
  severity: "info" | "warning" | "error";
  message: string;
  start_line: number;
  end_line: number;
};

export type ScanFixResponse = {
  request_id: string;
  status: string;
  findings: Finding[];
  fixed_code: string;
  explanation: string;
};

export async function scanAndFix(
  document: vscode.TextDocument,
  codeSnippet: string
): Promise<ScanFixResponse> {
  const payload = {
    request_id: crypto.randomUUID(),
    language: document.languageId,
    file_path: document.uri.fsPath,
    code_snippet: codeSnippet,
  };

  const response = await fetch("http://127.0.0.1:8000/v1/scan-fix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Backend request failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as ScanFixResponse;
}
