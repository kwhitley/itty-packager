// Template for extending the built-in itty-packager ESLint config
// Copy this to your project root as 'eslint.config.mjs' and customize as needed

import { createConfig } from 'itty-packager/lib/configs/createConfig.mjs'

export default createConfig({
  // Add custom rules specific to your project
  rules: {
    // Example: Allow console statements
    // 'no-console': 'off',
    
    // Example: Require spaces around object braces
    // 'object-curly-spacing': ['error', 'always'],
    
    // Example: Prefer template literals over string concatenation
    // 'prefer-template': 'error',
  },
  
  // Add project-specific ignores (in addition to defaults)
  ignores: [
    // 'test-fixtures/**',
    // 'docs/**',
  ]
})

// Available options for createConfig():
// - rules: Object with ESLint rule overrides
// - languageOptions: Parser and environment settings  
// - plugins: Additional ESLint plugins
// - ignores: Array of file patterns to ignore