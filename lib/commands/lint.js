import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'fs-extra'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
- Uses built-in TypeScript ESLint config if no local config found
- Local configs (eslint.config.mjs, .eslintrc.*, etc.) will override built-in config
- To extend built-in config: import { createConfig } from 'itty-packager/lib/configs/createConfig.mjs'
- Use specific paths to override the default exclusions
`)
    return
  }

  // Check for local ESLint configs
  const cwd = process.cwd()
  const localConfigFiles = [
    'eslint.config.mjs',
    'eslint.config.js', 
    '.eslintrc.mjs',
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc'
  ]
  
  const hasLocalConfig = localConfigFiles.some(file => 
    fs.existsSync(path.join(cwd, file))
  )
  
  // Find itty-packager's path and config
  const packagerPath = path.resolve(__dirname, '../../')
  const builtinConfig = path.join(packagerPath, 'lib', 'configs', 'eslint.config.mjs')
  
  // Check if we're in development (has ESLint binary) or published (use npx)
  const eslintBinaryPath = path.join(packagerPath, 'node_modules', '.bin', 'eslint')
  const isDevMode = await fs.pathExists(eslintBinaryPath)
  const eslintBinary = isDevMode ? eslintBinaryPath : 'eslint'
  
  const eslintArgs = []
  
  // Use built-in config if no local config exists
  if (!hasLocalConfig) {
    console.log(`🔧 Using built-in ESLint config (no local config found)`)
    eslintArgs.push('--config', builtinConfig)
  } else {
    console.log(`🔧 Using local ESLint config`)
  }
  
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
  
  // Run ESLint
  return new Promise((resolve, reject) => {
    const useNpx = !isDevMode
    const command = useNpx ? 'npx' : eslintBinary
    const args = useNpx ? ['eslint', ...eslintArgs] : eslintArgs
    
    // Set up environment with access to itty-packager's node_modules for ESLint plugins
    const env = { 
      ...process.env,
      NODE_PATH: `${path.join(packagerPath, 'node_modules')}:${process.env.NODE_PATH || ''}`
    }
    
    const eslint = spawn(command, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true,
      env
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