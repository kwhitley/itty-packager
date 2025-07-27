import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'

// Test tree types for hierarchical organization
export type TestLeaf = () => void | Promise<void>
export type TestTree = {
  [key: string]: TestTree | TestLeaf
}

// Test utilities for CLI command testing
export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface TestProject {
  dir: string
  cleanup: () => Promise<void>
}

export class CLITestRunner {
  private processes: ChildProcess[] = []

  async run(args: string[], options: { cwd?: string } = {}): Promise<CLIResult> {
    return new Promise((resolve, reject) => {
      const cwd = options.cwd || process.cwd()
      // Use absolute path to the itty.js script from the project root
      const projectRoot = process.cwd()
      const ittyScript = path.join(projectRoot, 'bin/itty.js')
      
      const proc = spawn('bun', [ittyScript, ...args], {
        cwd,
        stdio: 'pipe',
        shell: true
      })

      this.processes.push(proc)

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode: exitCode || 0 })
      })

      proc.on('error', (error) => {
        reject(error)
      })
    })
  }

  cleanup() {
    this.processes.forEach(proc => {
      if (!proc.killed) {
        proc.kill()
      }
    })
    this.processes = []
  }
}

export class ProjectFixture {
  private static testProjects: TestProject[] = []

  static async create(name: string, files: Record<string, string> = {}): Promise<TestProject> {
    const dir = path.join(tmpdir(), `itty-packager-test-${name}-${Date.now()}`)
    await fs.mkdir(dir, { recursive: true })

    // Default package.json if not provided
    if (!files['package.json']) {
      files['package.json'] = JSON.stringify({
        name: `test-${name}`,
        version: '1.0.0',
        type: 'module',
        scripts: {
          build: 'echo "no build"',
          test: 'echo "no test"',
          lint: 'echo "no lint"'
        }
      }, null, 2)
    }

    // Write all files
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(dir, filePath)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content)
    }

    const project: TestProject = {
      dir,
      cleanup: async () => {
        try {
          await fs.rm(dir, { recursive: true, force: true })
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    this.testProjects.push(project)
    return project
  }

  static async cleanupAll() {
    await Promise.all(this.testProjects.map(p => p.cleanup()))
    this.testProjects = []
  }
}

// Test runner that traverses the test tree
export const runTestTree = (tests: TestTree) => {
  // Import from bun:test at runtime
  const { describe, it } = require('bun:test')

  for (const [name, test] of Object.entries(tests)) {
    if (typeof test === 'function') {
      // Detect async vs sync tests
      if (test.constructor.name === 'AsyncFunction') {
        it(name, test)
      } else {
        it(name, test)
      }
    } else {
      describe(name, () => runTestTree(test))
    }
  }
}

// Assertion helpers
export const expectFile = (filePath: string) => {
  const exists = async () => {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  const content = async () => {
    return await fs.readFile(filePath, 'utf-8')
  }

  const json = async () => {
    const text = await content()
    return JSON.parse(text)
  }

  return {
    toExist: async () => {
      const fileExists = await exists()
      if (!fileExists) {
        throw new Error(`Expected file ${filePath} to exist`)
      }
      return true
    },
    toNotExist: async () => {
      const fileExists = await exists()
      if (fileExists) {
        throw new Error(`Expected file ${filePath} to not exist`)
      }
      return true
    },
    toContain: async (substring: string) => {
      const text = await content()
      if (!text.includes(substring)) {
        throw new Error(`Expected file ${filePath} to contain "${substring}"`)
      }
      return true
    },
    toMatchJSON: async (expected: any) => {
      const actual = await json()
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected file ${filePath} to match JSON:\n${JSON.stringify(expected, null, 2)}\nActual:\n${JSON.stringify(actual, null, 2)}`)
      }
      return true
    }
  }
}

// Common test fixtures
export const createTypescriptProject = () => ProjectFixture.create('typescript', {
  'src/index.ts': `
export function hello(name: string): string {
  return \`Hello, \${name}!\`
}

export const version = '1.0.0'
`,
  'src/utils.ts': `
export function add(a: number, b: number): number {
  return a + b
}
`,
  'package.json': JSON.stringify({
    name: 'test-typescript-project',
    version: '1.0.0',
    type: 'module',
    main: './dist/index.mjs',
    exports: {
      '.': './dist/index.mjs',
      './utils': './dist/utils.mjs'
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
  }, null, 2)
})

export const createSimpleProject = () => ProjectFixture.create('simple', {
  'src/simple.ts': `export const simple = 'hello world'`,
  'package.json': JSON.stringify({
    name: 'test-simple-project',
    version: '1.0.0',
    type: 'module'
  }, null, 2)
})