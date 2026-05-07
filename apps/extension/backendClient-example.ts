// VS Code Extension Integration Example
// This file shows how to integrate with the SentinelAI backend API

import * as vscode from 'vscode';
import fetch from 'node-fetch';  // npm install node-fetch
import * as crypto from 'crypto';

/**
 * SentinelAI Backend Client
 * Handles communication with the backend API
 */
export class SentinelAIClient {
    private backendUrl: string;
    private timeout: number = 30000; // 30 seconds

    constructor(backendUrl: string = 'http://localhost:8000') {
        this.backendUrl = backendUrl;
    }

    /**
     * Generate a unique request ID
     */
    private generateRequestId(): string {
        return `vscode-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }

    /**
     * Get the programming language from the file
     */
    private getLanguageFromUri(uri: vscode.Uri, languageId?: string): string {
        if (languageId) {
            return languageId;
        }

        const ext = uri.fsPath.split('.').pop()?.toLowerCase() || '';
        const extMap: { [key: string]: string } = {
            'py': 'python',
            'js': 'javascript',
            'ts': 'typescript',
            'jsx': 'javascript',
            'tsx': 'typescript',
            'java': 'java',
            'go': 'go',
            'cs': 'csharp',
            'php': 'php',
            'rb': 'ruby',
            'cpp': 'cpp',
            'c': 'c',
        };
        
        return extMap[ext] || ext;
    }

    /**
     * Scan code for vulnerabilities
     * 
     * @param code - Code snippet to scan
     * @param language - Programming language
     * @param filePath - File path (for context)
     * @param userInstruction - Optional user guidance
     * @returns API response with findings and fixes
     */
    async scanCode(
        code: string,
        language: string,
        filePath: string,
        userInstruction?: string
    ): Promise<ScanResponse> {
        const payload = {
            request_id: this.generateRequestId(),
            language,
            file_path: filePath,
            code_snippet: code,
            user_instruction: userInstruction
        };

        try {
            const response = await fetch(
                `${this.backendUrl}/v1/scan-fix`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    timeout: this.timeout
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as ScanResponse;
            return data;

        } catch (error) {
            throw new Error(
                `Failed to communicate with backend: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Health check - verify backend is available
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(
                `${this.backendUrl}/v1/health`,
                { timeout: 5000 }
            );
            return response.ok;
        } catch {
            return false;
        }
    }
}

/**
 * Response from the backend API
 */
export interface ScanResponse {
    request_id: string;
    status: 'ok' | 'partial_success' | 'error';
    findings: Finding[];
    fixed_code: string;
    explanation: string;
    timings_ms: {
        semgrep: number;
        llm: number;
    };
    errors: ServiceError[];
}

export interface Finding {
    rule_id: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning';
    message: string;
    start_line: number;
    end_line: number;
}

export interface ServiceError {
    source: string;
    code: string;
    detail: string;
}

/**
 * Command Handler for VS Code Extension
 * 
 * Example usage in extension.ts:
 * 
 * const client = new SentinelAIClient();
 * 
 * // Register command to scan selected code
 * vscode.commands.registerCommand('sentinelai.scanCode', async () => {
 *     const editor = vscode.window.activeTextEditor;
 *     if (!editor) return;
 *
 *     const selection = editor.selection;
 *     const code = editor.document.getText(selection);
 *     const language = editor.document.languageId;
 *     const filePath = editor.document.fileName;
 *
 *     // Show progress
 *     vscode.window.withProgress({
 *         location: vscode.ProgressLocation.Notification,
 *         title: "Scanning code for vulnerabilities...",
 *         cancellable: false
 *     }, async (progress) => {
 *         try {
 *             const response = await client.scanCode(code, language, filePath);
 *             
 *             // Handle response
 *             if (response.status === 'error') {
 *                 vscode.window.showErrorMessage(response.explanation);
 *                 return;
 *             }
 *
 *             if (response.findings.length === 0) {
 *                 vscode.window.showInformationMessage('✓ No vulnerabilities found!');
 *                 return;
 *             }
 *
 *             // Show findings and fixed code
 *             showResultsPanel(response);
 *
 *         } catch (error) {
 *             vscode.window.showErrorMessage(
 *                 `Scan failed: ${error instanceof Error ? error.message : String(error)}`
 *             );
 *         }
 *     });
 * });
 */

/**
 * Example: Create Diagnostics from Findings
 */
export function createDiagnostics(
    findings: Finding[],
    uri: vscode.Uri
): vscode.Diagnostic[] {
    return findings.map(finding => {
        const range = new vscode.Range(
            new vscode.Position(finding.start_line - 1, 0),
            new vscode.Position(finding.end_line, 0)
        );

        const severity = {
            'critical': vscode.DiagnosticSeverity.Error,
            'high': vscode.DiagnosticSeverity.Error,
            'medium': vscode.DiagnosticSeverity.Warning,
            'low': vscode.DiagnosticSeverity.Information,
            'info': vscode.DiagnosticSeverity.Hint,
            'warning': vscode.DiagnosticSeverity.Warning,
        }[finding.severity] ?? vscode.DiagnosticSeverity.Warning;

        const diagnostic = new vscode.Diagnostic(
            range,
            `[${finding.severity.toUpperCase()}] ${finding.message}`,
            severity
        );

        diagnostic.code = finding.rule_id;
        diagnostic.source = 'SentinelAI';

        return diagnostic;
    });
}

/**
 * Example: Display Results in Webview Panel
 */
export function showResultsPanel(response: ScanResponse): void {
    const panel = vscode.window.createWebviewPanel(
        'sentinelaiResults',
        'SentinelAI Scan Results',
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = generateResultsHTML(response);
}

function generateResultsHTML(response: ScanResponse): string {
    const findingsHTML = response.findings
        .map(f => `
            <div class="finding finding-${f.severity}">
                <h4>${f.severity.toUpperCase()}</h4>
                <p><strong>${f.rule_id}</strong></p>
                <p>${f.message}</p>
                <p style="font-size: 0.9em; color: #999;">
                    Lines ${f.start_line}-${f.end_line}
                </p>
            </div>
        `)
        .join('');

    const errorStatus = response.status === 'error' || response.status === 'partial_success';
    const errorHTML = response.errors
        .map(e => `
            <div class="error-item">
                <p><strong>${e.code}</strong> (${e.source})</p>
                <p>${e.detail}</p>
            </div>
        `)
        .join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; }
                .findings { margin-bottom: 20px; }
                .finding { 
                    border-left: 4px solid #999;
                    padding: 10px;
                    margin-bottom: 10px;
                    background: #f5f5f5;
                }
                .finding-critical { border-left-color: #f00; }
                .finding-high { border-left-color: #ff6600; }
                .finding-medium { border-left-color: #ffcc00; }
                .finding-low { border-left-color: #00cc00; }
                .finding-info { border-left-color: #0066ff; }
                
                .fixed-code {
                    background: #1e1e1e;
                    color: #d4d4d4;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                    font-family: 'Courier New', monospace;
                    margin: 10px 0;
                }
                
                .timings { font-size: 0.9em; color: #666; }
                .errors { background: #fee; border-left: 4px solid #f00; padding: 10px; margin: 10px 0; }
                .error-item { margin: 10px 0; }
            </style>
        </head>
        <body>
            <h2>Scan Results</h2>
            <p>Status: <strong>${response.status}</strong></p>
            
            <div class="timings">
                ⏱️ Semgrep: ${response.timings_ms.semgrep}ms | 
                LLM: ${response.timings_ms.llm}ms
            </div>

            ${response.findings.length > 0 ? `
                <div class="findings">
                    <h3>Vulnerabilities Found: ${response.findings.length}</h3>
                    ${findingsHTML}
                </div>
            ` : '<p style="color: green;">✓ No vulnerabilities found</p>'}

            ${response.fixed_code ? `
                <div>
                    <h3>Fixed Code</h3>
                    <pre class="fixed-code">${escapeHtml(response.fixed_code)}</pre>
                </div>
            ` : ''}

            <div>
                <h3>Explanation</h3>
                <p>${escapeHtml(response.explanation)}</p>
            </div>

            ${errorHTML ? `
                <div class="errors">
                    <h3>Errors</h3>
                    ${errorHTML}
                </div>
            ` : ''}
        </body>
        </html>
    `;
}

function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Extension Activation Example
 * 
 * export async function activate(context: vscode.ExtensionContext) {
 *     const client = new SentinelAIClient('http://localhost:8000');
 *
 *     // Check if backend is available
 *     const isHealthy = await client.healthCheck();
 *     if (!isHealthy) {
 *         vscode.window.showErrorMessage(
 *             'SentinelAI Backend is not available. ' +
 *             'Please ensure the backend server is running on http://localhost:8000'
 *         );
 *         return;
 *     }
 *
 *     // Register scan command
 *     const disposable = vscode.commands.registerCommand(
 *         'sentinelai.scanCode',
 *         async () => {
 *             // Implementation here
 *         }
 *     );
 *
 *     context.subscriptions.push(disposable);
 * }
 */
