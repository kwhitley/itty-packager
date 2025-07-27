import { describe, expect, it, afterAll } from 'bun:test'
import { 
  type TestTree, 
  runTestTree, 
  CLITestRunner, 
  ProjectFixture
} from './test-utils'

const cli = new CLITestRunner()

const tests: TestTree = {
  'itty lint': {
    'help output': {
      'shows help with --help': async () => {
        const result = await cli.run(['lint', '--help'])
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('itty lint')
        expect(result.stdout).toContain('--fix')
        expect(result.stdout).toContain('--quiet')
        expect(result.stdout).toContain('--format')
      }
    },

    'basic functionality': {
      'passes for clean TypeScript': async () => {
        const project = await ProjectFixture.create('clean-ts', {
          'src/clean.ts': `export const greet = (name: string) => \`Hello, \${name}!\``,
          'package.json': JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
        })
        
        const result = await cli.run(['lint'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('Using built-in ESLint config')
      }
    },

    'with specific paths': {
      'lints src directory': async () => {
        const project = await ProjectFixture.create('specific-files', {
          'src/good.ts': 'export const good = \'clean\'',
          'package.json': JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
        })
        
        const result = await cli.run(['lint', 'src/'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
      }
    }
  }
}

runTestTree(tests)

afterAll(async () => {
  cli.cleanup()
  await ProjectFixture.cleanupAll()
})