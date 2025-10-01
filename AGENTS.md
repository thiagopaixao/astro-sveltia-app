# Repository Guidelines

## Project Structure & Module Organization
The Electron entry point is `main.js`, which configures BrowserWindows, IPC handlers, and the SQLite-backed persistence stored under `app.getPath('userData')`. Keep long-running child process utilities near the existing helper functions. The `preload.js` bridge should stay lean, exposing only whitelisted channels. Renderer assets live under `renderer/` (`index.html`, `create.html`, etc.) with shared logic in `renderer/script.js`; extend per-view scripts by adding discrete modules rather than enlarging the global file. Place reusable UI images or styles inside a dedicated `renderer/assets/` folder if you introduce them.

## Build, Test, and Development Commands
Run `npm install` after cloning to sync Electron and SQLite binaries. Use `npm start` to launch the desktop app with live reload via Electron. For database troubleshooting, run `sqlite3 "$(electron --user-data-dir)/documental.db"` from the host terminal only after the app has created the file.

## Coding Style & Naming Conventions
Follow the existing two-space indentation and trailing semicolon conventions in `main.js` and `renderer/script.js`. Prefer CommonJS `require`/`module.exports` for new modules to remain consistent with the current configuration. Name IPC channels in kebab case (`command-status`) and keep handler names descriptive but concise (`initializeDatabase`). Front-end IDs and classes should stay lowercase-hyphenated to match the HTML templates.

## Testing Guidelines
The repository currently lacks automated tests; prioritize adding integration coverage with `electron-mocha` or `spectron`. Mirror production flows: start the app, seed a temporary workspace, validate window state changes, and clean up the SQLite file from `app.getPath('userData')`. Store tests under a future `tests/` directory, naming files `*.spec.js`. Replace the placeholder `npm test` script with your chosen runner, and require that it exits non-zero on failures.

## Commit & Pull Request Guidelines
Commit history mixes Portuguese and English summaries; align on a single language (prefer English) with a short imperative first line (`Add project deletion flow`). Reference tracked issues using `#123` in the body when applicable, and describe database migrations or IPC changes explicitly. Pull requests should include: purpose, testing evidence (`npm start`, new specs), screenshots or GIFs for UI updates, and notes about required migrations. Request review before merging and wait for CI once tests are configured.

## Security & Configuration Tips
Never commit user-specific SQLite files or credentials; add new paths to `.gitignore` as needed. When introducing environment variables, consume them via `process.env` in `main.js` and document them in this file. Limit preload exposure to functions that sanitize inputs, and validate any filesystem interaction before executing shell commands.
