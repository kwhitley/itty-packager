import { createConfig } from './lib/configs/createConfig.mjs'

export default createConfig({
  rules: {
    // Allow console statements in CLI tools
    'no-console': 'off',
    
    // Allow process global in Node.js CLI
    'no-undef': 'off',
    
    // Allow useless escapes in regex patterns
    'no-useless-escape': 'off',
  },
  
  languageOptions: {
    globals: {
      // Node.js globals
      process: 'readonly',
      console: 'readonly',
      Buffer: 'readonly',
      __dirname: 'readonly',
      __filename: 'readonly',
      global: 'readonly',
    }
  }
})