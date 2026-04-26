# apps

This folder groups the three main application surfaces in SentinelAI.

## backend
FastAPI service that receives code snippets from the extension, runs sanitization and Semgrep, and forwards safe context to the AI layer.

## extension
VS Code extension host code. This is where commands, diagnostics, code actions, and backend calls live.

## webview-ui
React UI used inside VS Code webviews for chat, diff preview, and fix review.
