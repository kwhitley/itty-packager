import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
})

// Base configuration that all itty projects should use
const baseConfig = [...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
), {
    plugins: {
        '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
        parser: tsParser,
    },

    rules: {
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'linebreak-style': ['error', 'unix'],
        'prefer-const': 'off',

        quotes: ['error', 'single', {
            allowTemplateLiterals: true,
        }],

        semi: ['error', 'never'],
    },
}]

/**
 * Create an ESLint config by extending the base itty configuration
 * @param {Object} overrides - Configuration overrides
 * @param {Object} overrides.rules - Additional or modified rules
 * @param {Object} overrides.languageOptions - Language options to merge
 * @param {Array} overrides.plugins - Additional plugins
 * @param {Array} overrides.ignores - Files/patterns to ignore
 * @returns {Array} ESLint flat config
 */
export function createConfig(overrides = {}) {
  const config = [...baseConfig]
  
  if (overrides.rules || overrides.languageOptions || overrides.plugins || overrides.ignores) {
    // Create a new config object that extends the base
    const extendedConfig = {
      ...config[config.length - 1], // Take the last config object from base
    }
    
    // Merge rules
    if (overrides.rules) {
      extendedConfig.rules = {
        ...extendedConfig.rules,
        ...overrides.rules
      }
    }
    
    // Merge language options
    if (overrides.languageOptions) {
      extendedConfig.languageOptions = {
        ...extendedConfig.languageOptions,
        ...overrides.languageOptions
      }
    }
    
    // Merge plugins
    if (overrides.plugins) {
      extendedConfig.plugins = {
        ...extendedConfig.plugins,
        ...overrides.plugins
      }
    }
    
    // Add ignores
    if (overrides.ignores) {
      extendedConfig.ignores = overrides.ignores
    }
    
    // Replace the last config in the array
    config[config.length - 1] = extendedConfig
  }
  
  return config
}

// Export the base config as default for direct use
export default baseConfig