import React, { useEffect, useMemo, useState } from "react";

type Finding = {
  rule_id: string;
  severity: "info" | "warning" | "error";
  message: string;
  start_line: number;
  end_line: number;
};

type ServiceError = {
  source: string;
  code: string;
  detail: string;
};

type ScanFixResponse = {
  request_id: string;
  status: string;
  findings: Finding[];
  original_code: string;
  fixed_code: string;
  explanation: string;
  timings_ms: Record<string, number>;
  errors?: ServiceError[];
};

type WebviewMessage =
  | { type: "SET_DATA"; data: ScanFixResponse }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "ERROR"; message: string };

type ExtensionMessage =
  | { type: "applyFix" }
  | { type: "refresh" }
  | { type: "fullScan" };

type VsCodeApi = {
  postMessage(message: ExtensionMessage): void;
};

type WindowWithSentinel = Window & {
  acquireVsCodeApi?: () => VsCodeApi;
  __SENTINELAI_INITIAL_STATE__?: ScanFixResponse;
};

const emptyResponse: ScanFixResponse = {
  request_id: "",
  status: "idle",
  findings: [],
  original_code: "",
  fixed_code: "",
  explanation: "Run a scan to inspect findings and suggested fixes.",
  timings_ms: {},
  errors: [],
};

function severityLabel(severity: Finding["severity"]): string {
  switch (severity) {
    case "error":
      return "Critical";
    case "warning":
      return "Warning";
    default:
      return "Info";
  }
}

function formatTimingEntries(timings: Record<string, number>): string {
  const entries = Object.entries(timings);
  if (entries.length === 0) {
    return "No timing data yet.";
  }

  return entries.map(([name, value]) => `${name}: ${value} ms`).join(" • ");
}

type DiffLine = {
  leftNumber: number | null;
  rightNumber: number | null;
  leftText: string;
  rightText: string;
  kind: "equal" | "remove" | "add" | "change";
};

function splitLines(code: string): string[] {
  return code.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function buildDiffLines(before: string, after: string): DiffLine[] {
  const left = splitLines(before);
  const right = splitLines(after);
  const maxLength = Math.max(left.length, right.length);
  const result: DiffLine[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const leftText = left[index] ?? "";
    const rightText = right[index] ?? "";

    if (leftText === rightText) {
      result.push({
        leftNumber: index < left.length ? index + 1 : null,
        rightNumber: index < right.length ? index + 1 : null,
        leftText,
        rightText,
        kind: "equal",
      });
      continue;
    }

    result.push({
      leftNumber: index < left.length ? index + 1 : null,
      rightNumber: index < right.length ? index + 1 : null,
      leftText,
      rightText,
      kind: leftText && rightText ? "change" : leftText ? "remove" : "add",
    });
  }

  return result;
}

function lineBadgeClass(kind: DiffLine["kind"]): string {
  switch (kind) {
    case "remove":
      return "bg-red-500/15 text-red-300 border-red-500/20";
    case "add":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/20";
    case "change":
      return "bg-amber-500/15 text-amber-300 border-amber-500/20";
    default:
      return "bg-slate-500/15 text-slate-300 border-slate-500/20";
  }
}

function diffLineClass(kind: DiffLine["kind"], side: "left" | "right"): string {
  if (kind === "remove" && side === "left") {
    return "bg-red-500/10 text-red-100";
  }
  if (kind === "add" && side === "right") {
    return "bg-emerald-500/10 text-emerald-100";
  }
  if (kind === "change") {
    return side === "left" ? "bg-red-500/10 text-red-100" : "bg-emerald-500/10 text-emerald-100";
  }
  return "bg-[#0b0f14] text-slate-200";
}

function renderLineNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

export function ChatPanel() {
  const windowWithSentinel = window as WindowWithSentinel;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<ScanFixResponse>(
    windowWithSentinel.__SENTINELAI_INITIAL_STATE__ ?? emptyResponse
  );

  const vscode = useMemo(() => {
    if (typeof windowWithSentinel.acquireVsCodeApi === "function") {
      return windowWithSentinel.acquireVsCodeApi();
    }

    return null;
  }, [windowWithSentinel]);

  useEffect(() => {
    const handler = (event: MessageEvent<WebviewMessage>) => {
      const payload = event.data;

      if (payload?.type === "SET_DATA") {
        setData(payload.data);
        setLoading(false);
        setMessage(null);
        return;
      }

      if (payload?.type === "SET_LOADING") {
        setLoading(payload.loading);
        return;
      }

      if (payload?.type === "ERROR") {
        setMessage(payload.message);
        setLoading(false);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const requestAction = (type: ExtensionMessage["type"]) => {
    if (!vscode) {
      setMessage("VS Code API is not available in this environment.");
      return;
    }

    setLoading(true);
    setMessage(null);
    vscode.postMessage({ type });
  };

  const copyFix = async () => {
    if (!data.fixed_code) {
      return;
    }

    await navigator.clipboard.writeText(data.fixed_code);
    setMessage("Fix copied to clipboard.");
  };

  const findings = data.findings ?? [];
  const errors = data.errors ?? [];
  const diffLines = useMemo(
    () => buildDiffLines(data.original_code ?? "", data.fixed_code ?? ""),
    [data.original_code, data.fixed_code]
  );
  const requestTitle = data.request_id ? `Request ${data.request_id}` : "No active request";

  return (
    <div className="flex flex-col h-screen bg-[#0f1115] text-[#94a3b8] font-sans text-xs">

      {/* Header - SENTINEL AI */}
      <header className="px-4 py-4 border-b border-[#1e293b] flex justify-between items-center bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-full" />
          <div>
            <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 animate-gradient-x">
              SENTINEL AI
            </h1>
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">
              {requestTitle}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-1 bg-[#1a1d23] border border-blue-500/20 rounded-full text-[9px] text-blue-400 font-bold uppercase tracking-tighter">
            {loading ? "Analyzing" : data.status || "Ready"}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* Section: Current Request */}
        <section>
          <div className="opacity-60 text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 ml-1">
            Current Request
          </div>
          <div className="bg-[#1a1d23] p-4 rounded-xl border border-[#2d3748] text-gray-300 italic shadow-inner">
            {data.explanation || "Waiting for scan results..."}
          </div>
        </section>

        {/* Section: Results */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div className="text-[10px] uppercase tracking-widest font-bold text-[#0ea5e9]">
              Security Analysis Report
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              ID: {data.request_id || "N/A"}
            </span>
          </div>

          {/* CARD 1: Vulnerability Finding */}
          {findings.length === 0 ? (
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 text-sm text-slate-400">
              No findings yet. Run a scan from the extension to populate this view.
            </div>
          ) : (
            findings.map((finding) => (
              <article
                key={`${finding.rule_id}-${finding.start_line}-${finding.end_line}`}
                className="relative overflow-hidden bg-[#161b22] shadow-2xl transition-all hover:border-[#414853]"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${finding.severity === "error"
                      ? "bg-red-500"
                      : finding.severity === "warning"
                        ? "bg-amber-400"
                        : "bg-sky-400"
                    }`}
                />

                <div className="p-4 bg-[#21262d]/40 flex justify-between items-start pl-7">
                  <div>
                    <h3 className="text-white font-bold text-sm mb-0.5">
                      {finding.message}
                    </h3>
                    <p className="text-gray-500 text-[10px]">
                      Rule: <span className="font-mono text-[#0ea5e9]">{finding.rule_id}</span>
                    </p>
                  </div>
                  <span className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[9px] font-black tracking-tighter">
                    {severityLabel(finding.severity)}
                  </span>
                </div>

                <div className="p-4 space-y-3 pl-7 border-t border-[#30363d]/30">
                  <p className="leading-relaxed text-[11px] text-gray-300">
                    Detected on lines <span className="text-white">{finding.start_line}</span>
                    {' '}
                    to <span className="text-white">{finding.end_line}</span>.
                  </p>
                </div>
              </article>
            ))
          )}

          <article className="overflow-hidden rounded-xl bg-[#161b22] border border-[#30363d] shadow-2xl">
            <div className="p-3 bg-[#21262d]/60 border-b border-[#30363d] flex justify-between items-center px-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-white font-bold text-[10px] uppercase tracking-wider">
                  Proposed Security Patch
                </span>
              </div>
              {/* ปุ่ม Copy โค้ดแบบไอคอน */}
              <button
                className="p-1.5 hover:bg-slate-700 rounded-md transition-colors text-slate-400 hover:text-white"
                title="Copy code"
                onClick={copyFix}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            <div className="border-b border-[#30363d] bg-[#0b0f14] px-4 py-2">
              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-slate-400">
                <span>Before / After Diff</span>
                <span className="text-slate-500">Git-style preview</span>
              </div>
            </div>
            <div className="overflow-x-auto font-mono text-[11px]">
              {data.original_code && data.fixed_code ? (
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-2 border-b border-[#30363d] text-[10px] uppercase tracking-widest text-slate-500">
                    <div className="px-4 py-2 border-r border-[#30363d]">Before</div>
                    <div className="px-4 py-2">After</div>
                  </div>
                  <div className="divide-y divide-[#30363d]">
                    {diffLines.map((line, index) => (
                      <div key={`${line.leftNumber ?? "x"}-${line.rightNumber ?? "y"}-${index}`} className="grid grid-cols-2">
                        <div className={`flex border-r border-[#30363d] ${diffLineClass(line.kind, "left")}`}>
                          <div className={`w-12 shrink-0 px-3 py-1.5 text-right text-[10px] border-r border-[#30363d] ${lineBadgeClass(line.kind)}`}>
                            {renderLineNumber(line.leftNumber)}
                          </div>
                          <pre className="flex-1 px-3 py-1.5 whitespace-pre-wrap break-words">{line.leftText || " "}</pre>
                        </div>
                        <div className={`flex ${diffLineClass(line.kind, "right")}`}>
                          <div className={`w-12 shrink-0 px-3 py-1.5 text-right text-[10px] border-r border-[#30363d] ${lineBadgeClass(line.kind)}`}>
                            {renderLineNumber(line.rightNumber)}
                          </div>
                          <pre className="flex-1 px-3 py-1.5 whitespace-pre-wrap break-words">{line.rightText || " "}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-black/40 p-4 space-y-1 text-slate-200">
                  {data.fixed_code ? (
                    <pre className="whitespace-pre-wrap overflow-x-auto">{data.fixed_code}</pre>
                  ) : (
                    <span>// Run a scan to generate a suggested patch.</span>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 bg-[#1c2128]/50 border-t border-[#30363d] flex justify-end px-4">
              <button
                className="bg-[#238636] hover:bg-[#2ea043] text-white px-4 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 shadow-lg shadow-green-900/20 active:scale-95"
                onClick={() => requestAction("applyFix")}
                disabled={!data.fixed_code}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Accept and Apply Fix
              </button>
            </div>
          </article>

          <section className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 shadow-2xl">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#0ea5e9]">
              Scan Timings
            </div>
            <p className="text-[11px] text-slate-400">{formatTimingEntries(data.timings_ms ?? {})}</p>
            {errors.length > 0 && (
              <ul className="mt-3 space-y-2 text-[11px] text-amber-300">
                {errors.map((error) => (
                  <li
                    key={`${error.source}-${error.code}`}
                    className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2"
                  >
                    <strong>{error.source}</strong> {error.code} - {error.detail}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Loading State */}
          {message && (
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-200">
              {message}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 border-4 border-[#0e639c]/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-[#0e639c] border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex flex-col items-center">
                <p className="text-[#0ea5e9] animate-pulse font-black tracking-widest text-[10px]">
                  AI ENGINE ANALYZING
                </p>
                <p className="text-gray-600 text-[9px]">
                  Deep Scanning for OWASP Vulnerabilities...
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer - Professional Action Bar */}
      <footer className="p-4 border-t border-[#1e293b] bg-[#0f1115] shadow-[0_-10px_20px_rgba(0,0,0,0.2)]">
        <div className="flex gap-3">
          <button
            onClick={() => requestAction("refresh")}
            className="flex-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white py-2.5 rounded-lg font-bold transition-all active:scale-95"
          >
            Refresh Analysis
          </button>
          <button
            onClick={() => requestAction("fullScan")}
            className="flex-1 bg-[#0e639c] hover:bg-[#1177bb] text-white py-2.5 rounded-lg font-bold shadow-lg shadow-blue-900/30 transition-all active:scale-95"
          >
            Full Scan
          </button>
        </div>
      </footer>
    </div>
  );
}