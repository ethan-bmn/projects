# Repository Guidelines

## Project Structure & Module Organization

This repository is an initial Git workspace with no application code, tests, assets, or dependency manifests. Keep new project files organized by purpose. For a single application, prefer `src/` for source code, `tests/` for tests, and `assets/` for static resources. If this workspace becomes a collection of projects, give each project its own directory and document its layout in its README.

## Build, Test, and Development Commands

No build, test, or local development commands are configured yet. When adding a project, document the exact installation, development, build, and test commands in its README. Use the chosen toolchain's standard commands and commit the relevant configuration and dependency lockfiles.

Useful repository checks:

- `git status --short`: review changed and untracked files.
- `git diff --check`: catch whitespace errors before committing.
- `git diff --stat`: check the scope of pending changes.

## Coding Style & Naming Conventions

No language, formatter, or linter has been selected. Follow the conventions of the language introduced, and add shared formatting and linting configuration early. Use descriptive names, consistent indentation, and small modules with clear responsibilities. Avoid mixing unrelated projects or generated output in the repository root.

## Testing Guidelines

No testing framework or coverage threshold exists. Add automated tests alongside new behavior, including meaningful edge cases and regression tests for fixes. Follow the selected framework's test naming conventions and document how to run the suite. Run applicable tests before opening a pull request.

## Commit & Pull Request Guidelines

There is no commit history establishing a message convention. Use concise, imperative subjects, such as `Add initial project structure`. Keep commits focused. Pull requests should explain the change, include validation results, link relevant issues, and provide screenshots for visible interface changes.

## Security & Configuration

Keep credentials and local configuration out of Git. Add appropriate `.gitignore` rules when introducing tooling, and provide example configuration with placeholder values where needed.
