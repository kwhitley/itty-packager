import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'
import fs from 'fs-extra'
import path from 'node:path'
import { build } from '../builder.js'
import { lintCommand } from './lint.js'

export async function prepareCommand(args) {
  const { values: prepareArgs } = parseArgs({
    args,
    options: {
      verbose: {
        type: 'boolean',
        short: 'v',
        description: 'Show all output from underlying commands'
      },
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help'
      }
    },
    allowPositionals: false
  })

  if (prepareArgs.help) {
    console.log(`
itty prepare - Run lint, test, and build in sequence

Usage: itty prepare [options]

Options:
  -v, --verbose    Show all output from underlying commands
  -h, --help       Show help

Examples:
  itty prepare           # Run lint, test, build silently (show only failures)
  itty prepare --verbose # Run with full output from all commands

Note:
- Uses package.json scripts if available (lint, test), falls back to built-in commands
- Only shows output when commands fail, unless --verbose is used
- Stops on first failure
`)
    return
  }

  const cwd = process.cwd()
  const packageJsonPath = path.join(cwd, 'package.json')
  
  let packageJson = {}
  if (await fs.pathExists(packageJsonPath)) {
    packageJson = await fs.readJson(packageJsonPath)
  }

  const scripts = packageJson.scripts || {}
  const verbose = prepareArgs.verbose

  console.log('🚀 Running prepare sequence...')

  // 1. Lint
  try {
    if (scripts.lint) {
      console.log('📋 Running lint script...')
      await runNpmScript('lint', verbose)
    } else {
      console.log('📋 Running built-in lint...')
      await lintCommand([])
    }
    if (!verbose) console.log('✅ Lint passed')
  } catch (error) {
    throw new Error(`Lint failed: ${error.message}`)
  }

  // 2. Test
  try {
    if (scripts.test) {
      console.log('🧪 Running test script...')
      await runNpmScript('test', verbose)
      if (!verbose) console.log('✅ Tests passed')
    } else {
      console.log('🧪 No test script found, skipping tests')
    }
  } catch (error) {
    throw new Error(`Tests failed: ${error.message}`)
  }

  // 3. Build
  try {
    if (scripts.build) {
      console.log('🔨 Running build script...')
      await runNpmScript('build', verbose)
      if (!verbose) console.log('✅ Build completed')
    } else {
      // Check if there's a src directory or TypeScript files to build
      const srcExists = await fs.pathExists(path.join(cwd, 'src'))
      if (srcExists) {
        console.log('🔨 Running built-in build...')
        await build({})
        if (!verbose) console.log('✅ Build completed')
      } else {
        console.log('🔨 No build script or src directory found, skipping build')
      }
    }
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`)
  }

  console.log('🎉 Prepare sequence completed successfully')
}

async function runNpmScript(scriptName, verbose) {
  return new Promise((resolve, reject) => {
    const stdio = verbose ? 'inherit' : 'pipe'
    const npm = spawn('npm', ['run', scriptName], {
      stdio,
      cwd: process.cwd(),
      shell: true
    })

    let stdout = ''
    let stderr = ''

    if (!verbose) {
      npm.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      npm.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
    }

    npm.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        // Show output on failure even if not verbose
        if (!verbose && (stdout || stderr)) {
          console.error('\n--- Output from failed command ---')
          if (stdout) console.log(stdout)
          if (stderr) console.error(stderr)
          console.error('--- End output ---\n')
        }
        reject(new Error(`Script '${scriptName}' exited with code ${code}`))
      }
    })

    npm.on('error', (error) => {
      reject(new Error(`Failed to run script '${scriptName}': ${error.message}`))
    })
  })
}