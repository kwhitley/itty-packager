import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'
import path from 'node:path'

export async function lintCommand(args) {
  const { values: lintArgs, positionals } = parseArgs({
    args,
    options: {
      fix: {
        type: 'boolean',
        description: 'Automatically fix problems'
      },
      'max-warnings': {
        type: 'string',
        description: 'Number of warnings to trigger nonzero exit code'
      },
      quiet: {
        type: 'boolean',
        short: 'q',
        description: 'Report errors only'
      },
      format: {
        type: 'string',
        short: 'f',
        description: 'Output format (stylish, compact, json, etc.)'
      },
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help'
      }
    },
    allowPositionals: true,
    strict: false
  })

  if (lintArgs.help) {
    console.log(`
itty lint - Lint your code with ESLint

Usage: itty lint [files/directories] [options]

Options:
      --fix               Automatically fix problems
      --max-warnings <n>  Number of warnings to trigger nonzero exit code
  -q, --quiet             Report errors only
  -f, --format <format>   Output format (stylish, compact, json, etc.)
  -h, --help              Show help

Examples:
  itty lint                    # Lint entire project (excludes node_modules, dist, build, etc.)
  itty lint src               # Lint only src directory
  itty lint --fix             # Lint entire project and auto-fix issues
  itty lint src --quiet       # Lint src directory, show errors only
  itty lint --format=json     # Lint entire project, output in JSON format

Note: 
- When no paths are specified, lints entire project excluding common build directories
- ESLint will automatically discover and use local config files (eslint.config.mjs, .eslintrc.*, etc.)
- Use specific paths to override the default exclusions
`)
    return
  }

  // Build ESLint command
  const eslintPath = path.join(process.cwd(), 'node_modules', 'itty-packager', 'node_modules', '.bin', 'eslint')
  const eslintArgs = []
  
  // Add positional arguments (files/directories to lint)
  if (positionals.length > 0) {
    eslintArgs.push(...positionals)
  } else {
    // Default to all JS/TS files, excluding common build directories
    eslintArgs.push(
      '.',
      '--ignore-pattern', 'node_modules/',
      '--ignore-pattern', 'dist/',
      '--ignore-pattern', 'build/',
      '--ignore-pattern', 'coverage/',
      '--ignore-pattern', '*.min.js',
      '--ignore-pattern', '*.bundle.js'
    )
  }
  
  // Add flags
  if (lintArgs.fix) {
    eslintArgs.push('--fix')
  }
  
  if (lintArgs['max-warnings']) {
    eslintArgs.push('--max-warnings', lintArgs['max-warnings'])
  }
  
  if (lintArgs.quiet) {
    eslintArgs.push('--quiet')
  }
  
  if (lintArgs.format) {
    eslintArgs.push('--format', lintArgs.format)
  }

  console.log(`🔍 Linting with ESLint...`)
  
  // Run ESLint from the current working directory so it finds local configs
  return new Promise((resolve, reject) => {
    const eslint = spawn('npx', ['eslint', ...eslintArgs], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true,
      env: { ...process.env, PATH: process.env.PATH }
    })

    eslint.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Linting completed successfully')
        resolve()
      } else {
        reject(new Error(`ESLint exited with code ${code}`))
      }
    })

    eslint.on('error', (error) => {
      reject(new Error(`Failed to run ESLint: ${error.message}`))
    })
  })
}