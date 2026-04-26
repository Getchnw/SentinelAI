# apps/extension

VS Code extension package for SentinelAI.

## What this folder contains
- `src/`: TypeScript source code for the extension.
- `out/`: compiled JavaScript output.
- `.vscode/`: debug configuration for running the extension in Extension Development Host.
- `package.json`: extension manifest, commands, and scripts.
- `tsconfig.json`: TypeScript compiler settings.

## Responsibilities
- read the active editor content or selection
- send code to the backend
- render diagnostics and quick fixes
- open the webview UI for chat and diff review
