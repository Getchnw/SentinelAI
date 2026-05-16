import * as vscode from "vscode";

export type Finding = {
  rule_id: string;
  severity: "info" | "warning" | "error";
  message: string;
  start_line: number;
  end_line: number;
};

export type ServiceError = {
  source: string;
  code: string;
  detail: string;
};

export type ScanFixResponse = {
  request_id: string;
  status: string;
  findings: Finding[];
  original_code: string;
  fixed_code: string;
  explanation: string;
  timings_ms: Record<string, number>;
  errors?: ServiceError[];
};

export type ScanOptions = {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  userInstruction?: string;
};

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "BackendRequestError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new BackendRequestError(
        `Backend request timed out after ${timeoutMs} ms.`,
        undefined,
        true
      );
    }

    throw new BackendRequestError(
      `Backend request failed: ${String(error)}`,
      undefined,
      true
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function scanAndFix(
  document: vscode.TextDocument,
  codeSnippet: string,
  options: ScanOptions = {}
): Promise<ScanFixResponse> {
  const payload = {
    request_id: crypto.randomUUID(),
    language: document.languageId,
    file_path: document.uri.fsPath,
    code_snippet: codeSnippet,
    user_instruction: options.userInstruction,
  };

  const timeoutMs = options.timeoutMs ?? 60_000;
  const retries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 500;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        "http://127.0.0.1:8000/v1/scan-fix",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        timeoutMs
      );

      if (!response.ok) {
        const detail = await response.text();
        const backendError = new BackendRequestError(
          `Backend request failed: ${response.status} ${detail}`,
          response.status,
          isRetryableStatus(response.status)
        );

        if (!backendError.retryable || attempt === retries) {
          throw backendError;
        }

        lastError = backendError;
      } else {
        return (await response.json()) as ScanFixResponse;
      }
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof BackendRequestError ? error.retryable : true;

      if (!retryable || attempt === retries) {
        throw error;
      }
    }

    if (attempt < retries) {
      await sleep(retryDelayMs * (attempt + 1));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new BackendRequestError("Backend request failed.");
}
