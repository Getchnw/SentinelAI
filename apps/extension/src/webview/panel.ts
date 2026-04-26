import * as vscode from "vscode";

export function showResultPanel(explanation: string): void {
  const panel = vscode.window.createWebviewPanel(
    "sentinelaiResult",
    "SentinelAI Result",
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = `
    <!doctype html>
    <html>
      <body style="font-family: sans-serif; padding: 16px;">
        <h2>SentinelAI Suggestion</h2>
        <p>${explanation}</p>
      </body>
    </html>
  `;
}
