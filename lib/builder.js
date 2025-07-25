import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'
import fs from 'fs-extra'
import { globby } from 'globby'
import { rollup } from 'rollup'
import bundleSize from 'rollup-plugin-bundle-size'
import copy from 'rollup-plugin-copy'
import { rimraf } from 'rimraf'
import path from 'path'

const DEFAULT_IGNORE_PATTERNS = ['**/*.spec.ts', '**/types.ts', '**/*.ignore.*.ts']

export async function build(options = {}) {
  const {
    from = 'src',
    out = 'dist',
    copy: copyFiles,
    snippet,
    sourcemap = false,
    hybrid = false,
    minify = true
  } = options

  console.log(`📦 Building from ${from}/ to ${out}/`)
  
  // Clean output directory
  await rimraf(out)
  await fs.ensureDir(out)

  // Scan files to build
  const pattern = `./${from}/*.ts`
  const files = (await globby(pattern, {
    ignore: DEFAULT_IGNORE_PATTERNS,
  })).map(filePath => ({
    path: filePath,
    name: path.basename(filePath, '.ts'),
    shortPath: filePath.replace(new RegExp(`(/${from})|(\.ts)`, 'g'), '').replace('./index', '.'),
    esm: path.join(out, path.basename(filePath, '.ts') + '.mjs'),
    cjs: path.join(out, path.basename(filePath, '.ts') + '.cjs'),
    types: path.join(out, path.basename(filePath, '.ts') + '.d.ts'),
  })).sort((a, b) => a.shortPath.toLowerCase() < b.shortPath.toLowerCase() ? -1 : 1)

  if (files.length === 0) {
    throw new Error(`No TypeScript files found in ${from}/`)
  }

  console.log(`📄 Found ${files.length} file(s):`, files.map(f => f.name).join(', '))

  // Determine export strategy
  const isSingleFile = files.length === 1
  const pkg = await fs.readJSON('./package.json')

  // Update package.json exports
  if (isSingleFile) {
    // Single file maps to root export
    const file = files[0]
    const exportObj = {
      import: `./${out}/${path.basename(file.esm)}`,
      types: `./${out}/${path.basename(file.types)}`,
    }
    
    // Add CJS export only if hybrid mode is enabled
    if (hybrid) {
      exportObj.require = `./${out}/${path.basename(file.cjs)}`
    }
    
    pkg.exports = {
      '.': exportObj
    }
  } else {
    // Multiple files get individual exports
    pkg.exports = files.reduce((acc, file) => {
      const exportObj = {
        import: `./${out}/${path.basename(file.esm)}`,
        types: `./${out}/${path.basename(file.types)}`,
      }
      
      // Add CJS export only if hybrid mode is enabled
      if (hybrid) {
        exportObj.require = `./${out}/${path.basename(file.cjs)}`
      }
      
      acc[file.shortPath] = exportObj
      return acc
    }, {})
  }

  // Write updated package.json
  await fs.writeJSON('./package.json', pkg, { spaces: 2 })

  // Build files with rollup
  const builds = []
  
  for (const file of files) {
    // Determine outputs based on hybrid mode
    const outputs = [
      {
        format: 'esm',
        file: file.esm,
        sourcemap,
      }
    ]
    
    // Add CJS output only if hybrid mode is enabled
    if (hybrid) {
      outputs.push({
        format: 'cjs',
        file: file.cjs,
        sourcemap,
      })
    }
    
    // Build plugins array
    const plugins = [
      typescript({ sourceMap: sourcemap }),
      bundleSize(),
    ]
    
    // Add terser only if minify is enabled
    if (minify) {
      plugins.splice(1, 0, terser()) // Insert terser before bundleSize
    }
    
    const config = {
      input: file.path,
      output: outputs,
      plugins,
    }

    // Add copy plugin only to the first build to avoid conflicts
    if (file === files[0] && copyFiles) {
      const copyTargets = copyFiles.split(',').map(f => f.trim()).map(src => ({ src, dest: out }))
      config.plugins.push(copy({ targets: copyTargets }))
    }

    builds.push(config)
  }

  // Add snippet build if requested
  if (snippet) {
    const snippetFile = files.find(f => f.name === snippet)
    if (!snippetFile) {
      throw new Error(`Snippet file "${snippet}" not found. Available files: ${files.map(f => f.name).join(', ')}`)
    }

    const snippetPlugins = [typescript()]
    
    // Add terser to snippet only if minify is enabled
    if (minify) {
      snippetPlugins.push(terser())
    }
    
    builds.push({
      input: snippetFile.path,
      output: {
        file: path.join(out, `${snippet}.snippet.js`),
        format: 'esm',
        name: snippet,
      },
      plugins: snippetPlugins,
    })
  }

  // Execute all builds
  for (const config of builds) {
    const bundle = await rollup(config)
    
    if (Array.isArray(config.output)) {
      for (const output of config.output) {
        await bundle.write(output)
      }
    } else {
      await bundle.write(config.output)
    }
    
    await bundle.close()
  }

  // Handle README snippet injection if requested
  if (snippet) {
    await injectSnippet(snippet, out)
  }

  console.log(`✨ Build completed: ${files.length} file(s) built to ${out}/`)
}

async function injectSnippet(snippetName, outDir) {
  const snippetPath = path.join(outDir, `${snippetName}.snippet.js`)
  
  if (!await fs.pathExists(snippetPath)) {
    console.warn(`⚠️  Snippet file not found: ${snippetPath}`)
    return
  }

  const transformCode = code => code
    .replace(/^let\s+(\w+)\s*=/, `let ${snippetName}=`)
    .replace(/;export\s*{[^}]+};?\s*$/, ';')

  const snippet = await fs.readFile(snippetPath, 'utf-8')
  const transformed = transformCode(snippet).trim()

  // Remove snippet file
  await fs.unlink(snippetPath)

  // Update README if it exists
  const readmePath = './README.md'
  if (await fs.pathExists(readmePath)) {
    const readme = await fs.readFile(readmePath, 'utf-8')
    const newReadme = readme.replace(
      /(<!-- BEGIN SNIPPET -->[\r\n]+```(?:js|ts)[\r\n]?).*?([\r\n]?```[\r\n]+<!-- END SNIPPET -->)/s,
      `$1${transformed}$2`
    )
    
    await fs.writeFile(readmePath, newReadme)
    console.log(`📝 README.md updated with ${snippetName} snippet`)
  }
}