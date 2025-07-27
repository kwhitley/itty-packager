import { afterAll, expect } from 'bun:test'
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
  'itty build': {
    'help output': {
      'shows help with --help': async () => {
        const result = await cli.run(['build', '--help'])
        expect(result.exitCode).toBe(0)
        expect(result.stdout).toContain('itty build')
        expect(result.stdout).toContain('--minify')
        expect(result.stdout).toContain('--hybrid')
        expect(result.stdout).toContain('--sourcemap')
      }
    },

    'error cases': {
      'fails when src directory does not exist': async () => {
        const project = await ProjectFixture.create('no-src', {
          'package.json': JSON.stringify({ name: 'test', version: '1.0.0' }, null, 2)
        })

        const result = await cli.run(['build'], { cwd: project.dir })
        expect(result.exitCode).not.toBe(0)
        expect(result.stderr).toContain('TypeScript files found')
      }
    },

    'basic build': {
      'builds simple TypeScript file': async () => {
        const project = await ProjectFixture.create('simple-build', {
          'src/index.ts': 'export const hello = "world"',
          'package.json': JSON.stringify({
            name: 'test-simple',
            version: '1.0.0',
            type: 'module'
          }, null, 2)
        })

        const result = await cli.run(['build'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        await expectFile(path.join(project.dir, 'dist/index.mjs')).toExist()
      }
    },

    'with custom directories': {
      'builds from lib/ to build/': async () => {
        const project = await ProjectFixture.create('custom-dirs', {
          'lib/main.ts': 'export const main = "custom"',
          'package.json': JSON.stringify({
            name: 'test-custom',
            version: '1.0.0',
            type: 'module'
          }, null, 2)
        })

        const result = await cli.run(['build', '--from=lib', '--out=build'], { cwd: project.dir })
        expect(result.exitCode).toBe(0)
        await expectFile(path.join(project.dir, 'build/main.mjs')).toExist()
      }
    }
  }
}

runTestTree(tests)

afterAll(async () => {
  cli.cleanup()
  await ProjectFixture.cleanupAll()
})