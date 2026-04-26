# apps/extension/src

Main TypeScript source for the VS Code extension.

## Subfolders
- `core/`: backend client and other low-level integration code.
- `providers/`: VS Code providers such as diagnostics and code actions.
- `webview/`: webview panel creation and messaging helpers.

## Entry point
- `extension.ts`: activates the extension, registers commands, and connects the pieces together.
