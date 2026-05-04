import * as vscode from "vscode";
import type { Finding, ScanFixResponse, ServiceError } from "../core/backendClient";

type ResultPanelData = ScanFixResponse;

type PanelCallbacks = {
  onApplyFix?: () => Promise<void> | void;
};

let activePanel: vscode.WebviewPanel | undefined;
let activeCallbacks: PanelCallbacks | undefined;

function createHtml(webview: vscode.Webview, data: ResultPanelData): string {
  const nonce = String(Date.now());
  const payload = JSON.stringify(data).replace(/</g, "\\u003c");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          :root { color-scheme: dark; }
          body {
            margin: 0;
            padding: 20px;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(180deg, #0f172a 0%, #111827 100%);
            color: #e5e7eb;
          }
          .shell {
            max-width: 960px;
            margin: 0 auto;
            display: grid;
            gap: 16px;
          }
          .hero, .card {
            background: rgba(15, 23, 42, 0.82);
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 16px;
            padding: 16px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.35);
          }
          .hero h2, .card h3 { margin: 0 0 8px; }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 12px 0 0;
            color: #cbd5e1;
            font-size: 12px;
          }
          .button-row { display: flex; gap: 10px; flex-wrap: wrap; }
          button {
            border: 0;
            border-radius: 999px;
            padding: 10px 16px;
            cursor: pointer;
            font-weight: 700;
          }
          .primary { background: #22c55e; color: #052e16; }
          .secondary { background: #334155; color: #e2e8f0; }
          .muted { color: #94a3b8; }
          ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
          .finding { border-left: 4px solid #64748b; padding: 10px 12px; background: rgba(30, 41, 59, 0.72); border-radius: 10px; }
          .finding-error { border-left-color: #ef4444; }
          .finding-warning { border-left-color: #f59e0b; }
          .finding-info { border-left-color: #38bdf8; }
          .finding small { display: block; color: #94a3b8; margin-top: 4px; }
          pre {
            white-space: pre-wrap;
            word-break: break-word;
            background: rgba(2, 6, 23, 0.75);
            border-radius: 12px;
            padding: 12px;
            overflow: auto;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="shell">
          <section class="hero">
            <h2>SentinelAI Result</h2>
            <p id="explanation"></p>
            <div class="button-row">
              <button class="primary" id="applyFix">Apply Fix</button>
              <button class="secondary" id="refresh">Refresh View</button>
            </div>
            <div class="meta" id="meta"></div>
          </section>
          <section class="card">
            <h3>Findings</h3>
            <ul id="findings"></ul>
          </section>
          <section class="card">
            <h3>Proposed Fix</h3>
            <pre id="fixedCode"></pre>
          </section>
          <div id="errors"></div>
        </div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const data = ${payload};

          const explanation = document.getElementById('explanation');
          const findingsHost = document.getElementById('findings');
          const fixedCode = document.getElementById('fixedCode');
          const meta = document.getElementById('meta');
          const errorsHost = document.getElementById('errors');

          explanation.textContent = data.explanation || 'No explanation returned.';
          fixedCode.textContent = data.fixed_code || 'No fix returned.';

          const timings = data.timings_ms || {};
          meta.textContent = Object.entries(timings).length
            ? Object.entries(timings).map(([key, value]) => key + ': ' + value + ' ms').join(' • ')
            : 'No timing data returned.';

          if (!data.findings || data.findings.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'muted';
            empty.textContent = 'No findings reported.';
            findingsHost.appendChild(empty);
          } else {
            for (const finding of data.findings) {
              const item = document.createElement('li');
              item.className = 'finding finding-' + finding.severity;

              const title = document.createElement('strong');
              title.textContent = finding.rule_id;

              const message = document.createElement('span');
              message.textContent = finding.message;

              const lines = document.createElement('small');
              lines.textContent = 'Lines ' + finding.start_line + '-' + finding.end_line;

              item.appendChild(title);
              item.appendChild(document.createElement('br'));
              item.appendChild(message);
              item.appendChild(lines);
              findingsHost.appendChild(item);
            }
          }

          if (data.errors && data.errors.length > 0) {
            const section = document.createElement('section');
            section.className = 'card';

            const heading = document.createElement('h3');
            heading.textContent = 'Backend Notes';

            const list = document.createElement('ul');
            for (const error of data.errors) {
              const item = document.createElement('li');
              item.textContent = error.source + ': ' + error.code + ' - ' + error.detail;
              list.appendChild(item);
            }

            section.appendChild(heading);
            section.appendChild(list);
            errorsHost.appendChild(section);
          }

          document.getElementById('applyFix').addEventListener('click', () => {
            vscode.postMessage({ type: 'applyFix' });
          });

          document.getElementById('refresh').addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
          });
        </script>
      </body>
    </html>
  `;
}

function setPanelHtml(panel: vscode.WebviewPanel, data: ResultPanelData): void {
  panel.webview.html = createHtml(panel.webview, data);
}

export function showResultPanel(
  context: vscode.ExtensionContext,
  response: ScanFixResponse,
  callbacks: PanelCallbacks = {}
): void {
  activeCallbacks = callbacks;

  if (activePanel) {
    setPanelHtml(activePanel, response);
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
    }
  );

  setPanelHtml(activePanel, response);

  activePanel.webview.onDidReceiveMessage(async (message) => {
    if (message?.type === "applyFix") {
      await activeCallbacks?.onApplyFix?.();
      return;
    }

    if (message?.type === "refresh") {
      activePanel?.reveal(vscode.ViewColumn.Beside);
    }
  });

  activePanel.onDidDispose(() => {
    activePanel = undefined;
    activeCallbacks = undefined;
  }, null, context.subscriptions);
}
