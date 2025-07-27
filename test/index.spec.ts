import { afterAll, expect } from 'bun:test'
import {
  CLITestRunner,
  type TestTree,
  runTestTree
} from '../utils/test-utils'

const cli = new CLITestRunner()

const tests: TestTree = {
  'itty CLI': {
    'global help': {
      'shows all available commands': async () => {
        const result = await cli.run(['--help'])
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('itty - Universal toolkit for itty libraries')
        expect(result.stdout).toContain('build')
        expect(result.stdout).toContain('lint')
        expect(result.stdout).toContain('prepare')
        expect(result.stdout).toContain('release')
      }
    },

    'version': {
      'shows version with --version': async () => {
        const result = await cli.run(['--version'])
        expect(result.exitCode).toBe(0)
        // Should output a version number
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/)
      }
    },

    'unknown command': {
      'shows error for invalid command': async () => {
        const result = await cli.run(['invalid-command'])
        expect(result.exitCode).toBe(1)
        expect(result.stderr).toContain('Unknown subcommand: invalid-command')
        expect(result.stderr).toContain('Available subcommands:')
      }
    },

    'subcommand help': {
      'each command shows help with --help': async () => {
        const commands = ['build', 'lint', 'prepare', 'release']

        for (const command of commands) {
          const result = await cli.run([command, '--help'])
          expect(result.exitCode).toBe(0)
          expect(result.stdout).toContain(`itty ${command}`)
          expect(result.stdout).toContain('Usage:')
          expect(result.stdout).toContain('--help')
        }
      }
    }
  }
}

runTestTree(tests)

afterAll(async () => {
  cli.cleanup()
})

// Import all other test files to run them
import './build.spec'
import './cli-integration.spec'
import './lint.spec'
import './prepare.spec'
import './release.spec'
