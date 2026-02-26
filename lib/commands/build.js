import { parseArgs } from 'node:util'
import { build } from '../builder.js'

export async function buildCommand(args) {
  const { values: buildArgs } = parseArgs({
    args,
    options: {
      from: {
        type: 'string',
        short: 'f',
        default: 'src',
        description: 'Source directory (default: src)'
      },
      out: {
        type: 'string',
        short: 'o',
        default: 'dist',
        description: 'Output directory (default: dist)'
      },
      copy: {
        type: 'string',
        short: 'c',
        description: 'Files to copy to output (comma-separated)'
      },
      sourcemap: {
        type: 'boolean',
        description: 'Generate source maps (default: false)'
      },
      hybrid: {
        type: 'boolean',
        description: 'Build both ESM and CJS (default: ESM only)'
      },
      minify: {
        type: 'boolean',
        description: 'Minify output with terser (default: true)'
      },
      'no-minify': {
        type: 'boolean',
        description: 'Skip minification'
      },
      'release-from': {
        type: 'string',
        description: 'Release directory - exports are relative to this (default: same as --out)'
      },
      snippet: {
        type: 'string',
        short: 's',
        description: 'Generate snippet file for README injection'
      },
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help'
      }
    },
    allowPositionals: false
  })

  if (buildArgs.help) {
    console.log(`
itty build - Build your library with rollup and typescript

Usage: itty build [options]

Options:
  -f, --from <dir>           Source directory (default: src)
  -o, --out <dir>            Output directory (default: dist)
  -c, --copy <files>         Files to copy to output (comma-separated)
      --sourcemap            Generate source maps (default: false)
      --hybrid               Build both ESM and CJS (default: ESM only)
      --minify               Minify output with terser (default: true)
      --no-minify            Skip minification
      --release-from <dir>   Release directory - exports relative to this (default: same as --out)
  -s, --snippet <name>       Generate snippet file for README injection
  -h, --help                 Show help

Examples:
  itty build                              # Build ESM only, minified, no sourcemaps
  itty build --hybrid --sourcemap         # Build both ESM/CJS with sourcemaps
  itty build --no-minify                  # Build without minification
  itty build --from=lib --out=build       # Build from lib/ to build/
  itty build --snippet=connect            # Build with connect snippet generation
  itty build --release-from=.             # Exports include output dir prefix (for root releasing)
`)
    return
  }

  // Handle minify logic (default true, but --no-minify overrides)
  if (buildArgs['no-minify']) {
    buildArgs.minify = false
  } else if (buildArgs.minify === undefined) {
    buildArgs.minify = true
  }

  try {
    await build(buildArgs)
    console.log('✅ Build completed successfully')
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`)
  }
}