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
  'CLI Integration': {
    'end-to-end workflow': {
      'build → lint → prepare → release': async () => {
        // Create a realistic TypeScript project
        const project = await ProjectFixture.create('e2e-workflow', {
          'src/index.ts': `
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export const version = '1.0.0'
`,
          'src/utils.ts': `
export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}
`,
          'package.json': JSON.stringify({
            name: 'test-e2e-project',
            version: '1.0.0',
            type: 'module',
            main: './dist/index.mjs',
            exports: {
              '.': './dist/index.mjs',
              './utils': './dist/utils.mjs'
            },
            scripts: {
              test: 'echo "All tests passed"'
            }
          }, null, 2),
          'tsconfig.json': JSON.stringify({
            compilerOptions: {
              target: 'ES2022',
              module: 'ESNext',
              moduleResolution: 'node',
              declaration: true,
              outDir: './dist',
              strict: true
            },
            include: ['src/**/*']
          }, null, 2),
          'README.md': '# Test E2E Project\n\nA test project for end-to-end workflow testing.',
          'LICENSE': 'MIT License\n\nCopyright (c) 2024 Test'
        })

        // Step 1: Build the project
        const buildResult = await cli.run(['build'], { cwd: project.dir })
        expect(buildResult.exitCode).toBe(0)

        // Verify build outputs exist
        await expectFile(path.join(project.dir, 'dist/index.mjs')).toExist()
        await expectFile(path.join(project.dir, 'dist/utils.mjs')).toExist()
        await expectFile(path.join(project.dir, 'dist/index.d.ts')).toExist()

        // Step 2: Lint the project
        const lintResult = await cli.run(['lint'], { cwd: project.dir })
        expect(lintResult.exitCode).toBe(0)

        // Step 3: Run prepare (should use the built files)
        const prepareResult = await cli.run(['prepare'], { cwd: project.dir })
        expect(prepareResult.exitCode).toBe(0)
        expect(prepareResult.stdout).toContain('Prepare sequence completed successfully')

        // Step 4: Dry run release to verify package structure
        const releaseResult = await cli.run([
          'release',
          '--dry-run',
          '--no-git',
          '--no-cleanup'
        ], { cwd: project.dir })
        expect(releaseResult.exitCode).toBe(0)
        expect(releaseResult.stdout).toContain('v1.0.0 → v1.0.1')

        // Verify release package structure
        const distDir = path.join(project.dir, '.dist')
        await expectFile(path.join(distDir, 'index.mjs')).toExist()
        await expectFile(path.join(distDir, 'utils.mjs')).toExist()
        await expectFile(path.join(distDir, 'README.md')).toExist()
        await expectFile(path.join(distDir, 'LICENSE')).toExist()

        // Verify package.json transformation
        const packageJsonContent = fs.readFileSync(
          path.join(distDir, 'package.json'),
          'utf-8'
        )
        const packageJson = JSON.parse(packageJsonContent)
        expect(packageJson.version).toBe('1.0.1')
        expect(packageJson.exports).toEqual({
          '.': {
            import: './index.mjs',
            types: './index.d.ts'
          },
          './utils': {
            import: './utils.mjs',
            types: './utils.d.ts'
          }
        })
      }
    },

    'hybrid build workflow': {
      'build with --hybrid then release': async () => {
        const project = await ProjectFixture.create('hybrid-workflow', {
          'src/main.ts': `
export default function main() {
  return 'Hello from hybrid build'
}
`,
          'package.json': JSON.stringify({
            name: 'test-hybrid',
            version: '1.0.0',
            type: 'module'
          }, null, 2)
        })

        // Build with hybrid mode
        const buildResult = await cli.run(['build', '--hybrid'], { cwd: project.dir })
        expect(buildResult.exitCode).toBe(0)

        // Should have both ESM and CJS outputs
        await expectFile(path.join(project.dir, 'dist/main.mjs')).toExist()
        await expectFile(path.join(project.dir, 'dist/main.js')).toExist()

        // Release should work with hybrid build
        const releaseResult = await cli.run([
          'release',
          '--dry-run',
          '--no-git'
        ], { cwd: project.dir })
        expect(releaseResult.exitCode).toBe(0)
      }
    },

    'root release workflow': {
      'release directly from root with --root': async () => {
        const project = await ProjectFixture.create('root-release', {
          'index.mjs': 'export const test = "root release"',
          'utils.mjs': 'export const utils = "helper"',
          'package.json': JSON.stringify({
            name: 'test-root-release',
            version: '1.0.0',
            type: 'module',
            exports: {
              '.': './index.mjs',
              './utils': './utils.mjs'
            }
          }, null, 2),
          'README.md': '# Root Release Test',
          'LICENSE': 'MIT'
        })

        const result = await cli.run([
          'release',
          '--root',
          '--dry-run',
          '--no-git',
          '--no-cleanup',
          '--verbose'
        ], { cwd: project.dir })

        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('Source: ./')

        // For root releases, files should be copied to a temp directory outside the project
        // The exact temp directory structure is implementation-specific, but we can verify
        // the release completed successfully
        expect(result.stdout).toContain('Successfully released')
      }
    },

    'error recovery': {
      'prepare failure prevents release': async () => {
        const project = await ProjectFixture.create('error-recovery', {
          'src/index.ts': 'export const test = \'value\'',
          'dist/index.mjs': 'export const test = "value"',
          'package.json': JSON.stringify({
            name: 'test-error-recovery',
            version: '1.0.0',
            type: 'module',
            scripts: {
              test: 'exit 1' // Failing test
            }
          }, null, 2)
        })

        // Release with --prepare should fail due to failing test
        const result = await cli.run([
          'release',
          '--prepare',
          '--dry-run',
          '--no-git'
        ], { cwd: project.dir })

        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('Command failed')

        // Should not reach the release phase
        expect(result.stdout).not.toContain('Publishing to npm')
      }
    }
  }
}

runTestTree(tests)

afterAll(async () => {
  cli.cleanup()
  await ProjectFixture.cleanupAll()
})