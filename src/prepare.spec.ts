import { describe, expect, it, afterAll } from 'bun:test'
import { 
  type TestTree, 
  runTestTree, 
  CLITestRunner, 
  ProjectFixture 
} from './test-utils'

const cli = new CLITestRunner()

const tests: TestTree = {
  'itty prepare': {
    'with default behavior': {
      'runs lint, test, build sequence': async () => {
        const project = await ProjectFixture.create('prepare-default', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            type: 'module',
            scripts: {
              lint: 'echo "lint passed"',
              test: 'echo "test passed"',
              build: 'echo "build passed"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('Running prepare sequence')
        expect(result.stdout).toContain('Running lint script')
        expect(result.stdout).toContain('Running test script')
        expect(result.stdout).toContain('Prepare sequence completed successfully')
      },

      'shows only progress messages by default': async () => {
        const project = await ProjectFixture.create('prepare-quiet', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              lint: 'echo "detailed lint output"',
              test: 'echo "detailed test output"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        // Should not show detailed output from scripts
        expect(result.stdout).not.toContain('detailed lint output')
        expect(result.stdout).not.toContain('detailed test output')
      }
    },

    'with --verbose': {
      'shows all command output': async () => {
        const project = await ProjectFixture.create('prepare-verbose', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              lint: 'echo "detailed lint output"',
              test: 'echo "detailed test output"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare', '--verbose'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        // Should show detailed output from all scripts
        expect(result.stdout).toContain('detailed lint output')
        expect(result.stdout).toContain('detailed test output')
      }
    },

    'with missing scripts': {
      'uses built-in lint when no lint script': async () => {
        const project = await ProjectFixture.create('no-lint-script', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              test: 'echo "test passed"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('Running built-in lint')
      },

      'skips test when no test script': async () => {
        const project = await ProjectFixture.create('no-test-script', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              lint: 'echo "lint passed"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('No test script found, skipping tests')
      },

      'skips build when no src directory and no build script': async () => {
        const project = await ProjectFixture.create('no-build', {
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              lint: 'echo "lint passed"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('No build script or src directory found, skipping build')
      }
    },

    'error handling': {
      'stops on lint failure': async () => {
        const project = await ProjectFixture.create('lint-failure', {
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              lint: 'exit 1',
              test: 'echo "should not run"',
              build: 'echo "should not run"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('Lint failed')
        expect(result.stdout).not.toContain('should not run')
      },

      'stops on test failure': async () => {
        const project = await ProjectFixture.create('test-failure', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              lint: 'echo "lint passed"',
              test: 'exit 1',
              build: 'echo "should not run"'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('Tests failed')
        expect(result.stdout).not.toContain('should not run')
      },

      'shows error output on failure': async () => {
        const project = await ProjectFixture.create('error-output', {
          'src/index.ts': 'export const value = \'test\'',
          'package.json': JSON.stringify({
            name: 'test-prepare',
            version: '1.0.0',
            scripts: {
              test: 'echo "test error details" && exit 1'
            }
          }, null, 2)
        })
        
        const result = await cli.run(['prepare'], { cwd: project.dir })
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toContain('test error details')
      }
    },

    'help output': {
      'shows help with --help': async () => {
        const result = await cli.run(['prepare', '--help'])
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('itty prepare')
        expect(result.stdout).toContain('--verbose')
        expect(result.stdout).toContain('Run lint, test, and build in sequence')
      }
    }
  }
}

runTestTree(tests)

afterAll(async () => {
  cli.cleanup()
  await ProjectFixture.cleanupAll()
})