import { afterAll, expect } from 'bun:test'
import * as fs from 'node:fs'
import path from 'node:path'
import {
  CLITestRunner,
  ProjectFixture,
  type TestTree,
  expectFile,
  runTestTree
} from '../utils/test-utils'

const cli = new CLITestRunner()

const tests: TestTree = {
  'itty release': {
    'version bumping': {
      'defaults to patch version': async () => {
        const project = await ProjectFixture.create('version-patch', {
          'dist/index.mjs': 'export const test = "value"',
          'package.json': JSON.stringify({
            name: 'test-version',
            version: '1.2.3',
            type: 'module'
          }, null, 2)
        })

        const result = await cli.run(['release', '--dry-run', '--no-git'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('v1.2.3 → v1.2.4')
      },

      '--major': {
        'bumps major version': async () => {
          const project = await ProjectFixture.create('version-major', {
            'dist/index.mjs': 'export const test = "value"',
            'package.json': JSON.stringify({
              name: 'test-version',
              version: '1.2.3',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--major', '--dry-run', '--no-git'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('v1.2.3 → v2.0.0')
        }
      },

      '--minor': {
        'bumps minor version': async () => {
          const project = await ProjectFixture.create('version-minor', {
            'dist/index.mjs': 'export const test = "value"',
            'package.json': JSON.stringify({
              name: 'test-version',
              version: '1.2.3',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--minor', '--dry-run', '--no-git'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('v1.2.3 → v1.3.0')
        }
      },

      '--no-version': {
        'skips bumping version': async () => {
          const project = await ProjectFixture.create('no-version', {
            'dist/index.mjs': 'export const test = "value"',
            'package.json': JSON.stringify({
              name: 'test-version',
              version: '1.2.3',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--no-version', '--dry-run', '--no-git'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('v1.2.3 → v1.2.3')
        }
      },

      '--type=alpha': {
        'creates alpha pre-release': async () => {
          const project = await ProjectFixture.create('version-alpha', {
            'dist/index.mjs': 'export const test = "value"',
            'package.json': JSON.stringify({
              name: 'test-version',
              version: '1.2.3',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--type=alpha', '--dry-run', '--no-git'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('v1.2.3 → v1.2.3-alpha.0')
        }
      }
    },

    'source directory options': {
      'default --src=dist': {
        'releases from dist directory': async () => {
          const project = await ProjectFixture.create('src-dist', {
            'dist/index.mjs': 'export const test = "dist"',
            'src/index.ts': 'export const test = "src"',
            'package.json': JSON.stringify({
              name: 'test-src',
              version: '1.0.0',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--dry-run', '--no-git', '--verbose'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('Source: dist/')
        }
      },

      '--root flag': {
        'releases from root directory': async () => {
          const project = await ProjectFixture.create('src-root', {
            'index.mjs': 'export const test = "root"',
            'package.json': JSON.stringify({
              name: 'test-src',
              version: '1.0.0',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--root', '--dry-run', '--no-git', '--verbose'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('Source: ./')
        }
      },

      '--src=custom': {
        'releases from custom directory': async () => {
          const project = await ProjectFixture.create('src-custom', {
            'lib/index.mjs': 'export const test = "lib"',
            'package.json': JSON.stringify({
              name: 'test-src',
              version: '1.0.0',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--src=lib', '--dry-run', '--no-git', '--verbose'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('Source: lib/')
        }
      }
    },

    'dry run mode': {
      'with --dry-run': {
        'simulates release without publishing': async () => {
          const project = await ProjectFixture.create('dry-run', {
            'dist/index.mjs': 'export const test = "value"',
            'package.json': JSON.stringify({
              name: 'test-dry-run',
              version: '1.0.0',
              type: 'module'
            }, null, 2)
          })

          const result = await cli.run(['release', '--dry-run', '--no-git'], { cwd: project.dir })
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain('Dry run - skipping publish')
          expect(result.stdout).toContain('Successfully released')
        }
      }
    },

    'package structure transformation': {
      'copies and transforms dist files': async () => {
        const project = await ProjectFixture.create('package-transform', {
          'dist/index.mjs': 'export const main = "test"',
          'dist/utils.mjs': 'export const utils = "helper"',
          'README.md': '# Test Package',
          'LICENSE': 'MIT License',
          'package.json': JSON.stringify({
            name: 'test-transform',
            version: '1.0.0',
            type: 'module',
            exports: {
              '.': './dist/index.mjs',
              './utils': './dist/utils.mjs'
            }
          }, null, 2)
        })

        const result = await cli.run(['release', '--dry-run', '--no-git', '--no-cleanup'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)

        // Check that temp directory was created with transformed structure
        const tempDir = path.join(project.dir, '.dist')
        await expectFile(path.join(tempDir, 'index.mjs')).toExist()
        await expectFile(path.join(tempDir, 'utils.mjs')).toExist()
        await expectFile(path.join(tempDir, 'README.md')).toExist()
        await expectFile(path.join(tempDir, 'LICENSE')).toExist()

        // Check that package.json was transformed
        const pkgContent = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8')
        const pkg = JSON.parse(pkgContent)
        expect(pkg.exports).toEqual({
          '.': './index.mjs',
          './utils': './utils.mjs'
        })
      }
    },

    'with --prepare flag': {
      'runs prepare before release': async () => {
        const project = await ProjectFixture.create('with-prepare', {
          'src/index.ts': 'export const test = "value"',
          'dist/index.mjs': 'export const test = "value"',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            type: 'module',
            scripts: {
              lint: 'echo "lint success"',
              test: 'echo "test success"'
            }
          }, null, 2)
        })

        const result = await cli.run(['release', '--prepare', '--dry-run', '--no-git'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('🚀 Running prepare sequence...')
        expect(result.stdout).toContain('🎉 Prepare sequence completed successfully')
      }
    },

    'error cases': {
      'fails when source directory missing': async () => {
        const project = await ProjectFixture.create('no-dist', {
          'package.json': JSON.stringify({
            name: 'test-no-dist',
            version: '1.0.0',
            type: 'module'
          }, null, 2)
        })

        const result = await cli.run(['release', '--dry-run', '--no-git'], { cwd: project.dir })
        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('Source directory "dist" does not exist')
      },

      'reverts version on failure': async () => {
        const project = await ProjectFixture.create('revert-version', {
          'package.json': JSON.stringify({
            name: 'test-revert',
            version: '1.0.0',
            type: 'module'
          }, null, 2)
        })

        // Simulate a failure during release (missing dist directory)
        const result = await cli.run([
          'release',
          '--no-git'
        ], { cwd: project.dir })

        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('Source directory "dist" does not exist')

        // Verify version was reverted back to original
        const pkgContent = fs.readFileSync(path.join(project.dir, 'package.json'), 'utf-8')
        const pkg = JSON.parse(pkgContent)
        expect(pkg.version).toBe('1.0.0')
      }
    },

    'help output': {
      'shows comprehensive help with --help': async () => {
        const result = await cli.run(['release', '--help'])
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('itty release')
        expect(result.stdout).toContain('--major')
        expect(result.stdout).toContain('--minor')
        expect(result.stdout).toContain('--patch')
        expect(result.stdout).toContain('--root')
        expect(result.stdout).toContain('--prepare')
        expect(result.stdout).toContain('--dry-run')
        expect(result.stdout).toContain('--tag')
        expect(result.stdout).toContain('--push')
        expect(result.stdout).toContain('Interactive Options')
      }
    }
  }
}

runTestTree(tests)

afterAll(async () => {
  cli.cleanup()
  await ProjectFixture.cleanupAll()
})