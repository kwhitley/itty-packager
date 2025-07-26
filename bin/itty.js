#!/usr/bin/env node

import { parseArgs } from 'node:util'

const subcommands = {
  build: () => import('../lib/commands/build.js').then(m => m.buildCommand),
  lint: () => import('../lib/commands/lint.js').then(m => m.lintCommand),
  prepare: () => import('../lib/commands/prepare.js').then(m => m.prepareCommand),
  release: () => import('../lib/commands/release.js').then(m => m.releaseCommand),
  // Future subcommands can be added here:
  // deploy: () => import('../lib/commands/deploy.js').then(m => m.deployCommand),
}

const { positionals, values: globalArgs } = parseArgs({
  args: process.argv.slice(2),
  options: {
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Show help'
    },
    version: {
      type: 'boolean',
      short: 'v',
      description: 'Show version'
    }
  },
  allowPositionals: true,
  strict: false
})

async function main() {
  const subcommand = positionals[0]

  if (globalArgs.version) {
    const pkg = await import('../package.json', { with: { type: 'json' } })
    console.log(pkg.default.version)
    process.exit(0)
  }

  if (!subcommand) {
    showHelp()
    process.exit(0)
  }

  // If global help is requested but there's a subcommand, let the subcommand handle it
  if (globalArgs.help && !subcommands[subcommand]) {
    showHelp()
    process.exit(0)
  }

  if (!subcommands[subcommand]) {
    console.error(`❌ Unknown subcommand: ${subcommand}`)
    console.error(`Available subcommands: ${Object.keys(subcommands).join(', ')}`)
    process.exit(1)
  }

  try {
    const commandModule = await subcommands[subcommand]()
    const remainingArgs = process.argv.slice(3) // Remove 'node', 'itty.js', and subcommand
    await commandModule(remainingArgs)
  } catch (error) {
    console.error('❌ Command failed:', error.message)
    process.exit(1)
  }
}

function showHelp() {
  console.log(`
itty - Universal toolkit for itty libraries

Usage: itty <subcommand> [options]

Subcommands:
  build     Build your library with rollup and typescript
  lint      Lint your code with ESLint
  prepare   Run lint, test, and build in sequence
  release   Version and release your package to npm

Global Options:
  -h, --help      Show help
  -v, --version   Show version

Examples:
  itty build --snippet=connect --hybrid    # Build with snippet and CJS support
  itty build --sourcemap --no-minify      # Build with sourcemaps, no minification
  itty lint                               # Lint entire project (smart exclusions)
  itty lint src                           # Lint only the src directory
  itty lint --fix                         # Lint and fix issues automatically
  itty release --patch                    # Version bump and release from dist/
  itty build --help                       # Show build-specific help

Run 'itty <subcommand> --help' for subcommand-specific options.
`)
}

main().catch(error => {
  console.error('❌ Unexpected error:', error.message)
  process.exit(1)
})