import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'
import fs from 'fs-extra'
import path from 'node:path'
import { prepareCommand } from './prepare.js'

const SEMVER_TYPES = ['major', 'minor', 'patch']

function transformPackageExports(pkg, srcDir) {
  // Transform package.json exports to remove srcDir prefix from paths
  if (pkg.exports) {
    const transformPath = (exportPath) => {
      if (typeof exportPath === 'string' && exportPath.startsWith(`./${srcDir}/`)) {
        return exportPath.replace(`./${srcDir}/`, './')
      }
      return exportPath
    }

    const transformExportObj = (exportObj) => {
      if (typeof exportObj === 'string') {
        return transformPath(exportObj)
      }
      
      if (typeof exportObj === 'object' && exportObj !== null) {
        const transformed = {}
        for (const [key, value] of Object.entries(exportObj)) {
          if (typeof value === 'string') {
            transformed[key] = transformPath(value)
          } else if (typeof value === 'object') {
            transformed[key] = transformExportObj(value)
          } else {
            transformed[key] = value
          }
        }
        return transformed
      }
      
      return exportObj
    }

    const transformedExports = {}
    for (const [key, value] of Object.entries(pkg.exports)) {
      transformedExports[key] = transformExportObj(value)
    }
    
    return { ...pkg, exports: transformedExports }
  }
  
  return pkg
}

function versionBump(currentVersion, type) {
  const parts = currentVersion.split('.').map(Number)
  
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
    default:
      // For pre-release versions like alpha, beta, rc
      if (currentVersion.includes(`-${type}`)) {
        // Increment the pre-release number
        const [base, prerelease] = currentVersion.split(`-${type}.`)
        const prereleaseNum = parseInt(prerelease) || 0
        return `${base}-${type}.${prereleaseNum + 1}`
      } else {
        // Add pre-release to current version
        return `${currentVersion}-${type}.0`
      }
  }
}

async function getCommitMessage(newVersion, silent = false) {
  if (silent) {
    return `released v${newVersion}`
  }

  return new Promise((resolve, reject) => {
    // Show placeholder with hidden cursor
    const placeholderText = '\x1b[90mpress enter to skip\x1b[0m'
    process.stdout.write(`💬 Commit message: ${placeholderText}\x1b[?25l`) // Hide cursor
    
    let inputLines = []
    let firstInput = true
    let placeholderCleared = false
    let inputBuffer = ''

    // Set up raw mode for immediate key detection
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const clearPlaceholder = () => {
      if (!placeholderCleared) {
        // Clear line and show prompt with cursor
        process.stdout.write('\r\x1b[K💬 Commit message: \x1b[?25h') // Show cursor
        placeholderCleared = true
      }
    }

    const handleInput = (chunk) => {
      const key = chunk.toString()
      
      // Check for escape sequences
      if (key === '\x1b') {
        // Wait for potential escape sequence completion
        setTimeout(() => {
          process.stdout.write('\r\x1b[K💬 Commit message: cancelled\x1b[?25h\n')
          cleanup()
          reject(new Error('User cancelled with Escape key'))
        }, 10)
        return
      }
      
      // Handle Ctrl+C
      if (key === '\x03') {
        process.stdout.write('\r\x1b[K💬 Commit message: cancelled\x1b[?25h\n')
        cleanup()
        reject(new Error('User cancelled with Ctrl+C'))
        return
      }
      
      // Handle Enter
      if (key === '\r' || key === '\n') {
        if (!placeholderCleared && inputBuffer === '') {
          // Empty input, skip
          process.stdout.write('\r\x1b[K💬 Commit message: \x1b[90mskipped\x1b[0m\x1b[?25h\n')
          cleanup()
          resolve(`released v${newVersion}`)
          return
        }
        
        // Single line input - finish immediately
        if (firstInput) {
          const customMessage = inputBuffer.trim()
          process.stdout.write('\x1b[?25h\n')
          cleanup()
          
          if (!customMessage) {
            process.stdout.write('\r💬 Commit message: \x1b[90mskipped\x1b[0m\n')
            resolve(`released v${newVersion}`)
          } else {
            const escapedMessage = customMessage.replace(/"/g, '\\"')
            resolve(`released v${newVersion} - ${escapedMessage}`)
          }
          return
        }
        
        // Multi-line: empty line finishes input
        if (inputBuffer.trim() === '') {
          finishInput()
          return
        }
        
        // Add line and continue
        inputLines.push(inputBuffer)
        inputBuffer = ''
        firstInput = false
        process.stdout.write('\n')
        return
      }
      
      // Handle backspace
      if (key === '\x7f' || key === '\x08') {
        if (!placeholderCleared) return // Can't backspace in placeholder
        
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1)
          process.stdout.write('\b \b')
        }
        return
      }
      
      // Handle printable characters
      if (key.length === 1 && key >= ' ' && key <= '~') {
        if (!placeholderCleared) {
          clearPlaceholder()
        }
        
        inputBuffer += key
        process.stdout.write(key)
        return
      }
    }

    const cleanup = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdin.removeListener('data', handleInput)
    }

    const finishInput = () => {
      const customMessage = inputLines.join('\n').trim()
      process.stdout.write('\x1b[?25h\n') // Show cursor and newline
      cleanup()
      
      if (!customMessage) {
        resolve(`released v${newVersion}`)
      } else {
        // Escape quotes in the custom message
        const escapedMessage = customMessage.replace(/"/g, '\\"')
        resolve(`released v${newVersion} - ${escapedMessage}`)
      }
    }

    process.stdin.on('data', handleInput)
  })
}

async function runCommand(command, cwd = process.cwd(), verbose = false) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ')
    const proc = spawn(cmd, args, {
      stdio: verbose ? 'inherit' : 'pipe',
      cwd,
      shell: true
    })

    let stdout = ''
    let stderr = ''

    if (!verbose) {
      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })
      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        // Always show error output regardless of verbose setting
        if (!verbose && stderr) {
          console.error(stderr)
        }
        reject(new Error(`Command failed with exit code ${code}: ${command}`))
      }
    })

    proc.on('error', (error) => {
      reject(new Error(`Failed to run command: ${error.message}`))
    })
  })
}

export async function publishCommand(args) {
  const { values: publishArgs } = parseArgs({
    args,
    options: {
      major: {
        type: 'boolean',
        description: 'Major release X.#.# for breaking changes'
      },
      minor: {
        type: 'boolean',
        description: 'Minor release #.X.# for feature additions'
      },
      patch: {
        type: 'boolean',
        description: 'Patch release #.#.X for bug fixes'
      },
      type: {
        type: 'string',
        description: 'Custom release type (alpha, beta, rc, etc.)'
      },
      src: {
        type: 'string',
        default: 'dist',
        description: 'Source directory to publish from (default: dist)'
      },
      dest: {
        type: 'string',
        default: '.dist',
        description: 'Temporary directory for publishing (default: .dist)'
      },
      'dry-run': {
        type: 'boolean',
        description: 'Build and prepare but do not publish'
      },
      'no-cleanup': {
        type: 'boolean',
        description: 'Leave temporary directory after publishing'
      },
      public: {
        type: 'boolean',
        description: 'Publish as public package (--access=public)'
      },
      tag: {
        type: 'boolean',
        description: 'Create git tag for release'
      },
      push: {
        type: 'boolean',
        description: 'Push changes and tags to git remote'
      },
      'no-git': {
        type: 'boolean',
        description: 'Skip all git operations'
      },
      'no-license': {
        type: 'boolean',
        description: 'Do not copy LICENSE file to published package'
      },
      prepare: {
        type: 'boolean',
        description: 'Run prepare (lint, test, build) before publishing'
      },
      silent: {
        type: 'boolean',
        description: 'Skip interactive prompts (use default commit message)'
      },
      verbose: {
        type: 'boolean',
        short: 'v',
        description: 'Show detailed output including npm and git command details'
      },
      help: {
        type: 'boolean',
        short: 'h',
        description: 'Show help'
      }
    },
    allowPositionals: false
  })

  if (publishArgs.help) {
    console.log(`
itty publish - Version and publish your package to npm

Usage: itty publish [options]

Version Options (default: patch):
      --major             Major release X.#.# for breaking changes
      --minor             Minor release #.X.# for feature additions  
      --patch             Patch release #.#.X for bug fixes (default)
      --type <type>       Custom release type (alpha, beta, rc, etc.)

Publish Options:
      --src <dir>         Source directory to publish from (default: dist)
      --dest <dir>        Temporary directory for publishing (default: .dist)
      --dry-run           Build and prepare but do not publish
      --no-cleanup        Leave temporary directory after publishing
      --public            Publish as public package (--access=public)
      --prepare           Run prepare (lint, test, build) before publishing
      --silent            Skip interactive prompts (use default commit message)
      --no-license        Do not copy LICENSE file to published package
  -v, --verbose           Show detailed output including npm and git command details

Git Options:
      --tag               Create git tag for release
      --push              Push changes and tags to git remote (prompts for commit message)
      --no-git            Skip all git operations
  -h, --help              Show help

Interactive Options:
When using --push, you'll be prompted for an optional commit message.
Press Enter to skip, Escape or Ctrl+C to cancel and revert version.

Examples:
  itty publish                   # Patch version bump and publish from dist/ (default)
  itty publish --minor --tag     # Minor bump, publish, and create git tag
  itty publish --type=alpha      # Pre-release alpha version
  itty publish --src=lib         # Publish from lib/ instead of dist/
  itty publish --dry-run         # Test the publish process

Note: This command extracts your build artifacts to a temporary directory,
adds root files (README.md, LICENSE, etc.), and publishes from there.
This creates a clean, flat package structure in node_modules.
`)
    return
  }

  // Determine release type (default to patch)
  const releaseType = publishArgs.major ? 'major' 
                    : publishArgs.minor ? 'minor'
                    : publishArgs.patch ? 'patch'
                    : publishArgs.type ? publishArgs.type
                    : 'patch' // Default to patch

  const rootPath = process.cwd()
  const srcDir = path.join(rootPath, publishArgs.src)
  
  // Handle root publishing (src=.) by using a different temp directory structure
  const isRootPublish = publishArgs.src === '.'
  const tempDir = isRootPublish 
    ? path.join(path.dirname(rootPath), `.${path.basename(rootPath)}-dist`)
    : path.join(rootPath, publishArgs.dest)
  const dryRun = publishArgs['dry-run']
  const noCleanup = publishArgs['no-cleanup']
  const publicAccess = publishArgs.public
  const shouldTag = publishArgs.tag
  const shouldPush = publishArgs.push
  const noGit = publishArgs['no-git']
  const noLicense = publishArgs['no-license']
  const shouldPrepare = publishArgs.prepare
  const silent = publishArgs.silent
  const verbose = publishArgs.verbose

  // Read package.json and store original version for potential revert
  const pkgPath = path.join(rootPath, 'package.json')
  const originalPkg = await fs.readJSON(pkgPath)
  const originalVersion = originalPkg.version
  const newVersion = versionBump(originalVersion, releaseType)

  try {
    // Run prepare if requested
    if (shouldPrepare) {
      console.log('🚀 Running prepare sequence before publishing...')
      await prepareCommand(verbose ? ['--verbose'] : [])
      console.log('✅ Prepare completed successfully\n')
    }

    console.log(`📦 Publishing ${originalPkg.name} v${originalVersion} → v${newVersion}`)
    if (verbose) console.log(`📁 Source: ${publishArgs.src}/`)

    // Check if source directory exists
    if (!await fs.pathExists(srcDir)) {
      throw new Error(`Source directory "${publishArgs.src}" does not exist. Run "itty build" first.`)
    }

    // Clean and create temp directory
    if (verbose) console.log(`🧹 Preparing ${publishArgs.dest}/`)
    await fs.emptyDir(tempDir)
    await fs.ensureDir(tempDir)

    // Copy source files to temp directory
    console.log(`📋 Copying files...`)
    if (verbose) console.log(`📋 Copying ${publishArgs.src}/ to ${path.relative(rootPath, tempDir)}/`)
    
    const filter = (src) => {
      // Always exclude node_modules
      if (src.includes('node_modules')) return false
      
      // For root publishing, exclude additional files
      if (isRootPublish) {
        const relativePath = path.relative(srcDir, src)
        return !relativePath.startsWith('.git') && 
               !relativePath.includes('.DS_Store') &&
               !relativePath.includes('coverage/') &&
               !relativePath.includes('.nyc_output/')
      }
      
      return true
    }
    
    await fs.copy(srcDir, tempDir, { filter })
    if (!verbose) console.log(`✅ Files copied`)

    // Copy root files that should be included in the package (only for non-root publishing)
    if (!isRootPublish) {
      const rootFiles = [
        'README.md',  // Always copy README
        '.npmrc'      // Always copy .npmrc if it exists
      ]
      
      // Add optional files based on flags
      if (!noLicense) rootFiles.push('LICENSE')
      
      for (const file of rootFiles) {
        const srcFile = path.join(rootPath, file)
        const destFile = path.join(tempDir, file)
        
        if (await fs.pathExists(srcFile)) {
          if (verbose) console.log(`📄 Copying ${file}`)
          await fs.copy(srcFile, destFile)
        }
      }
    }

    // Update package.json in temp directory with transformed paths
    const updatedPkg = isRootPublish 
      ? { ...originalPkg, version: newVersion }  // No path transformation for root publishing
      : transformPackageExports({ ...originalPkg, version: newVersion }, publishArgs.src)
    const tempPkgPath = path.join(tempDir, 'package.json')
    
    const transformMessage = isRootPublish ? '' : ' (transforming paths)'
    if (verbose) console.log(`📝 Updating package.json to v${newVersion}${transformMessage}`)
    await fs.writeJSON(tempPkgPath, updatedPkg, { spaces: 2 })

    // Update root package.json first (before git operations)
    if (!dryRun) {
      if (verbose) console.log(`📝 Updating root package.json`)
      await fs.writeJSON(pkgPath, updatedPkg, { spaces: 2 })
    }

    // Git operations (before publishing)
    if (!noGit && !dryRun) {
      if (shouldPush || shouldTag) {
        try {
          // Get commit message (interactive or default)
          const commitMessage = await getCommitMessage(newVersion, silent)
          
          console.log(`📋 Committing changes...`)
          if (verbose) console.log(`Running: git add . && git commit`)
          await runCommand('git add .', rootPath, verbose)
          await runCommand(`git commit -m "${commitMessage}"`, rootPath, verbose)
          if (!verbose) console.log(`✅ Changes committed`)
        } catch (error) {
          if (error.message.includes('cancelled')) {
            console.log('📋 Commit cancelled - reverting version and exiting')
            // Revert the version we just updated
            await fs.writeJSON(pkgPath, originalPkg, { spaces: 2 })
            // Don't rethrow - exit cleanly since this is user-initiated
            process.exit(0)
          }
          throw error
        }
      }

      if (shouldTag) {
        console.log(`🏷️  Creating git tag v${newVersion}`)
        await runCommand(`git tag -a v${newVersion} -m "Release v${newVersion}"`, rootPath, verbose)
        if (!verbose) console.log(`✅ Tag created`)
      }

      if (shouldPush) {
        console.log(`📤 Pushing to remote...`)
        await runCommand('git push', rootPath, verbose)
        if (!verbose) console.log(`✅ Pushed to remote`)
        
        if (shouldTag) {
          console.log(`📤 Pushing tags...`)
          await runCommand('git push --tags', rootPath, verbose)
          if (!verbose) console.log(`✅ Tags pushed`)
        }
      }
    }

    // NPM publish as final step
    if (dryRun) {
      console.log('🧪 Dry run - skipping publish')
    } else {
      // Publish from temp directory
      console.log(`🚀 Publishing to npm...`)
      
      const publishCmd = [
        'npm publish',
        publicAccess ? '--access=public' : '',
        SEMVER_TYPES.includes(releaseType) ? '' : `--tag=${releaseType}`
      ].filter(Boolean).join(' ')

      if (verbose) console.log(`Running: ${publishCmd}`)
      await runCommand(publishCmd, tempDir, verbose)
      if (!verbose) console.log(`✅ Published to npm`)
    }

    // Cleanup
    if (!noCleanup) {
      if (verbose) console.log(`🧹 Cleaning up ${publishArgs.dest}/`)
      await fs.remove(tempDir)
    }

    console.log(`✅ Successfully published ${originalPkg.name}@${newVersion}`)
    
  } catch (error) {
    console.error(`❌ Publish failed: ${error.message}`)
    
    // Revert version in root package.json if it was changed
    if (!dryRun) {
      try {
        const currentPkg = await fs.readJSON(pkgPath)
        if (currentPkg.version !== originalVersion) {
          if (verbose) console.log(`🔄 Reverting version from v${currentPkg.version} to v${originalVersion}`)
          await fs.writeJSON(pkgPath, { ...currentPkg, version: originalVersion }, { spaces: 2 })
          console.log(`✅ Version reverted to v${originalVersion}`)
        }
      } catch (revertError) {
        console.error(`❌ Failed to revert version: ${revertError.message}`)
      }
    }
    
    // Cleanup on error
    if (await fs.pathExists(tempDir) && !noCleanup) {
      await fs.remove(tempDir)
    }
    
    throw error
  }
}