import * as vscode from "vscode";
import type { ScanFixResponse } from "../core/backendClient";

let activePanel: vscode.WebviewPanel | undefined;

export function showResultPanel(
  context: vscode.ExtensionContext,
  response: ScanFixResponse,
  callbacks: { onApplyFix?: () => Promise<void> | void } = {}
): void {
  if (activePanel) {
    activePanel.webview.postMessage({ type: "SET_DATA", data: response });
    activePanel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  activePanel = vscode.window.createWebviewPanel(
    "sentinelaiResult",
    "SentinelAI Result",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      // แก้ไข Path ตรงนี้ให้ถอยออกไป 1 ก้าวเพื่อให้เจอโฟลเดอร์ webview-ui ที่ถูกต้อง
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "..", "webview-ui", "dist")
      ],
    }
  );

  const webview = activePanel.webview;
  // ถอยออกจาก apps/extension ไปที่ apps/ แล้วเข้า webview-ui/dist
  const distPath = vscode.Uri.joinPath(context.extensionUri, "..", "webview-ui", "dist");

  // ดึงไฟล์ Assets ตามชื่อที่คุณผิงแคปมา (เช็คตัวเล็กใหญ่และตัวเลขให้ดีนะครับ)
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distPath, "assets", "index-DoDP0QKd.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(distPath, "assets", "index-DqxwHZFp.css")
  );

  webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource} 'unsafe-inline'; style-src ${webview.cspSource} 'unsafe-inline';">
      
      <link rel="stylesheet" href="${styleUri}">
      <title>SentinelAI</title>
      <style>
        body { 
          background-color: #0f1115; 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
        }
        #root { 
          height: 100vh; 
          width: 100vw; 
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      
      <script type="module" src="${scriptUri}"></script>
      
      <script>
        const vscode = acquireVsCodeApi();
        console.log("SentinelAI: Webview script loaded from ${scriptUri}");
      </script>
    </body>
    </html>
  `;

  activePanel.webview.onDidReceiveMessage(async (message) => {
    if (message?.type === "applyFix") {
      await callbacks.onApplyFix?.();
    }
  });

  activePanel.onDidDispose(() => {
    activePanel = undefined;
  }, null, context.subscriptions);
}