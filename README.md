<br />

<p>
<a href="https://itty.dev/itty-packager" target="_blank">
  <img src="https://ity.sh/WtTvnDwJ" alt="itty-packager" height="120" />
</a>
</p>

[![GitHub](https://img.shields.io/badge/GitHub-%23555.svg?style=flat-square&logo=github&logoColor=#fff)](https://github.com/kwhitley/itty-packager)
[![Version](https://img.shields.io/npm/v/itty-packager.svg?style=flat-square)](https://npmjs.com/package/itty-packager)
[![Issues](https://img.shields.io/github/issues/kwhitley/itty-packager?style=flat-square)](https://github.com/kwhitley/itty-packager/issues)
[![Discord](https://img.shields.io/discord/832353585802903572?label=Discord&logo=Discord&style=flat-square&logoColor=fff)](https://discord.gg/53vyrZAu9u)

### [Documentation](https://itty.dev/itty-packager) &nbsp;| &nbsp; [Discord](https://discord.gg/53vyrZAu9u)

---

# Single dependency build + release for TypeScript libraries.

Zero-config build, lint, prepare, and release - letting you deliver packages with minimal files and minimal bytes.

## Features

- **🔨 Build** - TypeScript compilation with Rollup, minification, and snippet generation
- **🔍 Lint** - Built-in ESLint configuration with TypeScript support and smart extending
- **🚀 Prepare** - Run lint, test, and build in sequence to verify your package
- **📦 Release** - Automated version bumping, git operations, and npm publishing with interactive commit messages
- **⚡ Zero Config** - Works out of the box, customize only what you need
- **🎯 Consistent** - Unified tooling across all itty projects

## Installation

```bash
npm install --save-dev itty-packager
```

## Quick Start

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "build": "itty build --hybrid",
    "lint": "itty lint",
    "release": "itty release --prepare"
  }
}
```

## Commands

### `itty build`

Build your TypeScript library with Rollup, TypeScript compilation, and optional minification.

**Usage:** `itty build [options]`

**Options:**
- `-f, --from <dir>` - Source directory (default: `src`)
- `-o, --out <dir>` - Output directory (default: `dist`)
- `-c, --copy <files>` - Files to copy to output (comma-separated)
- `--sourcemap` - Generate source maps (default: `false`)
- `--hybrid` - Build both ESM and CJS (default: ESM only)
- `--minify` - Minify output with terser (default: `true`)
- `--no-minify` - Skip minification
- `-s, --snippet <name>` - Generate snippet file for README injection
- `-h, --help` - Show help

**Default Behavior:**
- Compiles all TypeScript files from `src/` to `dist/`
- Generates ESM (`.mjs`) output only
- Minifies output by default
- Updates `package.json` exports with correct paths
- Single file exports map to root export, multiple files get individual exports

**Examples:**
```bash
itty build                              # Basic ESM build, minified
itty build --hybrid --sourcemap        # Build both ESM/CJS with sourcemaps
itty build --snippet=connect           # Build with snippet generation for README
itty build --from=lib --out=build      # Build from lib/ to build/
```

### `itty lint`

Lint your code with ESLint using built-in TypeScript configuration or your local config.

**Usage:** `itty lint [files/directories] [options]`

**Options:**
- `--fix` - Automatically fix problems
- `--max-warnings <n>` - Number of warnings to trigger nonzero exit code
- `-q, --quiet` - Report errors only
- `-f, --format <format>` - Output format (stylish, compact, json, etc.)
- `-h, --help` - Show help

**Default Behavior:**
- Uses built-in TypeScript ESLint config if no local config found
- Lints entire project excluding `node_modules/`, `dist/`, `build/`, `coverage/`
- Local configs (`.eslintrc.*`, `eslint.config.*`) override built-in config
- All ESLint dependencies provided by itty-packager

**Config Extension:**
Create `eslint.config.mjs` to extend the built-in config:
```javascript
import { createConfig } from 'itty-packager/lib/configs/createConfig.mjs'

export default createConfig({
  rules: {
    'no-console': 'off',  // Project-specific overrides
  }
})
```

**Examples:**
```bash
itty lint                    # Lint entire project with smart exclusions
itty lint src               # Lint only src directory
itty lint --fix             # Lint and auto-fix issues
itty lint --format=json     # Output results in JSON format
```

### `itty prepare`

Run lint, test, and build in sequence to prepare your package for release.

**Usage:** `itty prepare [options]`

**Options:**
- `-v, --verbose` - Show all output from underlying commands
- `-h, --help` - Show help

**Default Behavior:**
- Runs `lint` using package.json script or built-in command
- Runs `test` using package.json script (skips if not found)
- Runs `build` using package.json script or built-in command (skips if no src/ directory)
- Shows only progress messages unless `--verbose` is used
- Stops on first failure and shows error output

**Examples:**
```bash
itty prepare           # Run lint, test, build silently (show only failures)
itty prepare --verbose # Run with full output from all commands
```

### `itty release`

Version bump and release your package to npm with git operations and clean, flat package structure.

**Usage:** `itty release [options]`

**Version Options (default: patch):**
- `--major` - Major release X.#.# for breaking changes
- `--minor` - Minor release #.X.# for feature additions
- `--patch` - Patch release #.#.X for bug fixes (default)
- `--type <type>` - Custom release type (alpha, beta, rc, etc.)

**Release Options:**
- `--src <dir>` - Source directory to release from (default: `dist`)
- `--root` - Release from root directory (equivalent to `--src=.`)
- `--dest <dir>` - Temporary directory for releasing (default: `.dist`)
- `--dry-run` - Build and prepare but do not publish
- `--no-cleanup` - Leave temporary directory after releasing
- `--public` - Publish as public package (`--access=public`)
- `--prepare` - Run prepare (lint, test, build) before releasing
- `--silent` - Skip interactive prompts (use default commit message)
- `--no-license` - Do not copy LICENSE file to published package
- `-v, --verbose` - Show detailed output including npm and git command details

**Git Options:**
- `--tag` - Create git tag for release
- `--push` - Push changes and tags to git remote (prompts for commit message)
- `--no-git` - Skip all git operations

**Interactive Features:**
- When using `--push`, you'll be prompted for an optional commit message
- Press Enter to skip, Escape or Ctrl+C to cancel and revert version
- Multi-line commit messages supported
- Git tag uses the same message as the commit

**Default Behavior:**
- Defaults to patch version bump if no type specified
- Extracts build artifacts to temporary directory
- Copies root files: `README.md`, `LICENSE`, `.npmrc` (if they exist)
- Transforms package.json paths (e.g., `./dist/file.mjs` → `./file.mjs`)
- Creates clean, flat package structure in node_modules

**Examples:**
```bash
itty release                   # Patch bump and release from dist/ (default)
itty release --minor --tag     # Minor bump, release, and create git tag
itty release --type=alpha      # Pre-release alpha version
itty release --root            # Release from root directory
itty release --prepare --push  # Run prepare, then release with git operations
itty release --dry-run         # Test the release process
itty release --verbose         # Show detailed output during release
itty release --silent --push   # Release with git operations, no interactive prompts
```

## Package Structure

The release command creates a clean package structure by:

1. **Extracting build artifacts** from your `dist/` directory to package root
2. **Copying essential files** like README, LICENSE
3. **Transforming paths** in package.json to point to root-level files
4. **Publishing the clean structure** so users get flat imports

**Before (in your project):**
```
package.json exports: "./dist/connect.mjs"
dist/connect.mjs
README.md
LICENSE
```

**After (in node_modules):**
```
package.json exports: "./connect.mjs"
connect.mjs
README.md
LICENSE
```

## Configuration

### ESLint

The built-in ESLint config includes:
- TypeScript support with `@typescript-eslint`
- Sensible defaults for itty projects
- Unix line endings, single quotes, no semicolons
- Disabled rules: `no-empty-function`, `no-explicit-any`, `ban-types`, `ban-ts-comment`

Override by creating `eslint.config.mjs` in your project root.

### Package.json

Add itty-packager to your scripts for easy access:

```json
{
  "scripts": {
    "build": "itty build --snippet=mylib --hybrid",
    "lint": "itty lint",
    "prepare": "itty prepare",
    "release": "itty release --prepare --tag --push"
  }
}
```

## License

MIT
