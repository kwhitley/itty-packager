import { parseArgs } from 'node:util'
import { spawn } from 'node:child_process'
import fs from 'fs-extra'
import path from 'node:path'

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

async function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ')
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      cwd,
      shell: true
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
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
      'no-changelog': {
        type: 'boolean',
        description: 'Do not copy CHANGELOG.md file to published package'
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
      --no-license        Do not copy LICENSE file to published package
      --no-changelog      Do not copy CHANGELOG.md file to published package

Git Options:
      --tag               Create git tag for release
      --push              Push changes and tags to git remote
      --no-git            Skip all git operations
  -h, --help              Show help

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
  const tempDir = path.join(rootPath, publishArgs.dest)
  const dryRun = publishArgs['dry-run']
  const noCleanup = publishArgs['no-cleanup']
  const publicAccess = publishArgs.public
  const shouldTag = publishArgs.tag
  const shouldPush = publishArgs.push
  const noGit = publishArgs['no-git']
  const noLicense = publishArgs['no-license']
  const noChangelog = publishArgs['no-changelog']

  try {
    // Read package.json
    const pkgPath = path.join(rootPath, 'package.json')
    const pkg = await fs.readJSON(pkgPath)
    const newVersion = versionBump(pkg.version, releaseType)

    console.log(`📦 Publishing ${pkg.name} v${pkg.version} → v${newVersion}`)
    console.log(`📁 Source: ${publishArgs.src}/`)

    // Check if source directory exists
    if (!await fs.pathExists(srcDir)) {
      throw new Error(`Source directory "${publishArgs.src}" does not exist. Run "itty build" first.`)
    }

    // Clean and create temp directory
    console.log(`🧹 Preparing ${publishArgs.dest}/`)
    await fs.emptyDir(tempDir)
    await fs.ensureDir(tempDir)

    // Copy source files to temp directory
    console.log(`📋 Copying ${publishArgs.src}/ to ${publishArgs.dest}/`)
    const filter = (src) => !src.includes('node_modules')
    await fs.copy(srcDir, tempDir, { filter })

    // Copy root files that should be included in the package
    const rootFiles = [
      'README.md',  // Always copy README
      '.npmrc'      // Always copy .npmrc if it exists
    ]
    
    // Add optional files based on flags
    if (!noLicense) rootFiles.push('LICENSE')
    if (!noChangelog) rootFiles.push('CHANGELOG.md')
    
    for (const file of rootFiles) {
      const srcFile = path.join(rootPath, file)
      const destFile = path.join(tempDir, file)
      
      if (await fs.pathExists(srcFile)) {
        console.log(`📄 Copying ${file}`)
        await fs.copy(srcFile, destFile)
      }
    }

    // Update package.json in temp directory with transformed paths
    const updatedPkg = transformPackageExports({ ...pkg, version: newVersion }, publishArgs.src)
    const tempPkgPath = path.join(tempDir, 'package.json')
    
    console.log(`📝 Updating package.json to v${newVersion} (transforming paths)`)
    await fs.writeJSON(tempPkgPath, updatedPkg, { spaces: 2 })

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

      console.log(`Running: ${publishCmd}`)
      await runCommand(publishCmd, tempDir)
      
      // Update root package.json
      console.log(`📝 Updating root package.json`)
      await fs.writeJSON(pkgPath, updatedPkg, { spaces: 2 })
    }

    // Git operations
    if (!noGit && !dryRun) {
      if (shouldPush || shouldTag) {
        console.log(`📋 Committing changes...`)
        await runCommand('git add .', rootPath)
        await runCommand(`git commit -m "released v${newVersion}"`, rootPath)
      }

      if (shouldTag) {
        console.log(`🏷️  Creating git tag v${newVersion}`)
        await runCommand(`git tag -a v${newVersion} -m "Release v${newVersion}"`, rootPath)
      }

      if (shouldPush) {
        console.log(`📤 Pushing to remote...`)
        await runCommand('git push', rootPath)
        
        if (shouldTag) {
          console.log(`📤 Pushing tags...`)
          await runCommand('git push --tags', rootPath)
        }
      }
    }

    // Cleanup
    if (!noCleanup) {
      console.log(`🧹 Cleaning up ${publishArgs.dest}/`)
      await fs.remove(tempDir)
    }

    console.log(`✅ Successfully published ${pkg.name}@${newVersion}`)
    
  } catch (error) {
    console.error(`❌ Publish failed: ${error.message}`)
    
    // Cleanup on error
    if (await fs.pathExists(tempDir) && !noCleanup) {
      await fs.remove(tempDir)
    }
    
    throw error
  }
}