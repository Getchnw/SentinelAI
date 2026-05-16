import * as vscode from "vscode";
import type { ScanFixResponse } from "../core/backendClient";

type PanelCallbacks = {
  onApplyFix?: () => Promise<void> | void;
  onRefresh?: () => Promise<void> | void;
  onFullScan?: () => Promise<void> | void;
};

let activePanel: vscode.WebviewPanel | undefined;
let activeCallbacks: PanelCallbacks = {};

function escapeJson(value: string): string {
  return value.replace(/</g, "\\u003c");
}

function getAssetUris(context: vscode.ExtensionContext, webview: vscode.Webview): {
  scriptUri: vscode.Uri;
  styleUri: vscode.Uri;
} {
  const distPath = vscode.Uri.joinPath(context.extensionUri, "..", "webview-ui", "dist");
  return {
    scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(distPath, "assets", "index.js")),
    styleUri: webview.asWebviewUri(vscode.Uri.joinPath(distPath, "assets", "index.css")),
  };
}

function createHtml(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  response: ScanFixResponse
): string {
  const nonce = String(Date.now());
  const { scriptUri, styleUri } = getAssetUris(context, webview);
  const initialState = escapeJson(JSON.stringify(response));

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          http-equiv="Content-Security-Policy"
          content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};"
        />
        <link rel="stylesheet" href="${styleUri}" />
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
        <script nonce="${nonce}">
          window.__SENTINELAI_INITIAL_STATE__ = ${initialState};
        </script>
        <script type="module" src="${scriptUri}"></script>
      </body>
    </html>
  `;
}

function updateWebviewData(response: ScanFixResponse): void {
  if (!activePanel) {
    return;
  }

  activePanel.webview.postMessage({ type: "SET_DATA", data: response });
  activePanel.webview.postMessage({ type: "SET_LOADING", loading: false });
}

function updateWebviewLoading(loading: boolean): void {
  if (!activePanel) {
    return;
  }

  activePanel.webview.postMessage({ type: "SET_LOADING", loading });
}

function updateWebviewMessage(message: string): void {
  if (!activePanel) {
    return;
  }

  activePanel.webview.postMessage({ type: "INFO", message });
}

export function showResultPanel(
  context: vscode.ExtensionContext,
  response: ScanFixResponse,
  callbacks: PanelCallbacks = {}
): void {
  activeCallbacks = callbacks;

  if (activePanel) {
    updateWebviewData(response);
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
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "..", "webview-ui", "dist"),
      ],
    }
  );

  activePanel.webview.html = createHtml(context, activePanel.webview, response);

  activePanel.webview.onDidReceiveMessage(async (message) => {
    try {
      console.log("[SentinelAI] webview action received:", message?.type);

      if (message?.type === "applyFix") {
        updateWebviewLoading(true);
        await activeCallbacks.onApplyFix?.();
        updateWebviewLoading(false);
        updateWebviewMessage("Fix applied to the active editor.");
        return;
      }

      if (message?.type === "refresh") {
        updateWebviewLoading(true);
        await activeCallbacks.onRefresh?.();
        updateWebviewLoading(false);
        updateWebviewMessage("Refresh analysis completed.");
        return;
      }

      if (message?.type === "fullScan") {
        updateWebviewLoading(true);
        await activeCallbacks.onFullScan?.();
        updateWebviewLoading(false);
        updateWebviewMessage("Full scan completed.");
      }
    } catch (error) {
      updateWebviewLoading(false);
      updateWebviewMessage(`Action failed: ${String(error)}`);
    }
  });

  activePanel.onDidDispose(() => {
    activePanel = undefined;
    activeCallbacks = {};
  }, null, context.subscriptions);
}