# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Commands
- `bun bin/itty.js lint` - Lint the codebase using the CLI tool itself
- `bun bin/itty.js build` - Build the project (not typically needed as this is the build tool itself)
- `echo 'No tests yet'` - Current test command (no test suite implemented)

### Release Commands
- `bun bin/itty.js publish --patch --tag --dry-run --src=. --no-license` - Dry run release
- `bun bin/itty.js publish --patch --tag --push --src=. --no-license` - Patch release (quiet by default)
- `bun bin/itty.js publish --minor --tag --push --src=. --no-license` - Minor release
- `bun bin/itty.js publish --major --tag --push --src=. --no-license` - Major release
- Add `--verbose` flag to any command for detailed output including npm and git details

### CLI Usage
The main CLI entry point is `bin/itty.js` which provides three core commands:
- `itty build` - TypeScript compilation with Rollup
- `itty lint` - ESLint with built-in TypeScript configuration
- `itty publish` - Version bumping and npm publishing

## Architecture

### Core Components

**CLI Entry Point** (`bin/itty.js`):
- Main executable that dynamically imports command modules
- Handles global flags (--help, --version) and subcommand routing
- Supports build, lint, and publish subcommands

**Build System** (`lib/builder.js`):
- Core build logic using Rollup and TypeScript
- Handles ESM/CJS hybrid builds, minification with terser, sourcemaps
- Automatically updates package.json exports based on build outputs
- Supports snippet generation for README injection
- Single file exports map to root export, multiple files get individual exports

**Command Modules** (`lib/commands/`):
- **build.js**: Wraps builder.js with CLI argument parsing
- **lint.js**: ESLint integration with smart config detection
- **publish.js**: Version bumping, package extraction, and npm publishing

**ESLint Configuration** (`lib/configs/`):
- **createConfig.mjs**: Factory function for extending base TypeScript ESLint config
- **eslint.config.mjs**: Base configuration with TypeScript support
- Automatically used when no local ESLint config is found

### Key Architectural Patterns

**Dynamic Command Loading**: Commands are lazily loaded to improve startup time and allow future extensibility.

**Smart Configuration**: The lint command detects local ESLint configs and falls back to built-in TypeScript configuration when none exists.

**Clean Package Publishing**: The publish command creates a flat package structure by extracting build artifacts to a temporary directory, copying essential files (README, LICENSE, CHANGELOG), and transforming package.json paths before publishing.

**Extensible ESLint**: Projects can extend the built-in config using `createConfig()` from `itty-packager/lib/configs/createConfig.mjs`.

### Build Output Handling

The build system automatically manages package.json exports:
- Single TypeScript file → root export (`"."`)
- Multiple TypeScript files → individual named exports
- Paths are automatically updated to point to dist/ directory
- ESM builds by default, CJS optional with `--hybrid` flag

### Publishing Workflow

The publish command transforms the package structure:
1. Extracts build artifacts from dist/ to temporary directory
2. Copies root files (README.md, LICENSE, .npmrc)
3. Transforms package.json paths (e.g., `./dist/file.mjs` → `./file.mjs`)
4. Publishes the clean, flat structure
5. Updates root package.json with new version
6. Optionally handles git tagging and pushing