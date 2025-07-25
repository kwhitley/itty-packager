<br />

<p>
<a href="https://itty.dev/itty-packager" target="_blank">
  <img src="https://github.com/user-attachments/assets/placeholder-image" alt="itty-packager" height="120" />
</a>
</p>

[![Version](https://img.shields.io/npm/v/itty-packager.svg?style=flat-square)](https://npmjs.com/package/itty-packager)
[![Bundle Size](https://deno.bundlejs.com/?q=itty-packager&badge&badge-style=flat-square)](https://deno.bundlejs.com/?q=itty-packager)
[![Coverage Status](https://img.shields.io/coveralls/github/kwhitley/itty-packager?style=flat-square)](https://coveralls.io/github/kwhitley/itty-packager)
[![Issues](https://img.shields.io/github/issues/kwhitley/itty-packager?style=flat-square)](https://github.com/kwhitley/itty-packager/issues)
[![Discord](https://img.shields.io/discord/832353585802903572?label=Discord&logo=Discord&style=flat-square&logoColor=fff)](https://discord.gg/53vyrZAu9u)

### [Documentation](https://itty.dev) &nbsp;| &nbsp; [Discord](https://discord.gg/53vyrZAu9u)

---

# Universal toolkit for itty libraries

Zero-config build, lint, and publish workflows for TypeScript libraries.

## Features

- **🔨 Build** - TypeScript compilation with Rollup, minification, and snippet generation
- **🔍 Lint** - Built-in ESLint configuration with TypeScript support and smart extending
- **📦 Publish** - Automated version bumping, clean package extraction, and npm publishing
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
    "build": "itty build",
    "lint": "itty lint", 
    "publish": "itty publish"
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

### `itty publish`

Version bump and publish your package to npm with clean, flat package structure.

**Usage:** `itty publish [options]`

**Version Options (default: patch):**
- `--major` - Major release X.#.# for breaking changes
- `--minor` - Minor release #.X.# for feature additions
- `--patch` - Patch release #.#.X for bug fixes (default)
- `--type <type>` - Custom release type (alpha, beta, rc, etc.)

**Publish Options:**
- `--src <dir>` - Source directory to publish from (default: `dist`)
- `--dest <dir>` - Temporary directory for publishing (default: `.dist`)
- `--dry-run` - Build and prepare but do not publish
- `--no-cleanup` - Leave temporary directory after publishing
- `--public` - Publish as public package (`--access=public`)
- `--no-license` - Do not copy LICENSE file to published package
- `--no-changelog` - Do not copy CHANGELOG.md file to published package

**Git Options:**
- `--tag` - Create git tag for release
- `--push` - Push changes and tags to git remote
- `--no-git` - Skip all git operations

**Default Behavior:**
- Defaults to patch version bump if no type specified
- Extracts build artifacts to temporary directory
- Copies root files: `README.md`, `LICENSE`, `CHANGELOG.md`, `.npmrc` (if they exist)
- Transforms package.json paths (e.g., `./dist/file.mjs` → `./file.mjs`)
- Creates clean, flat package structure in node_modules

**Examples:**
```bash
itty publish                   # Patch bump and publish from dist/ (default)
itty publish --minor --tag     # Minor bump, publish, and create git tag
itty publish --type=alpha      # Pre-release alpha version
itty publish --dry-run         # Test the publish process
itty publish --no-license      # Publish without copying LICENSE file
```

## Package Structure

The publish command creates a clean package structure by:

1. **Extracting build artifacts** from your `dist/` directory to package root
2. **Copying essential files** like README, LICENSE, CHANGELOG
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
    "publish": "itty publish --tag --push"
  }
}
```

## License

MIT