#!/usr/bin/env node

/**
 * Script to generate tree.mdc cursor rules file for the current repository.
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get repository root (one level up from scripts directory)
const repoRoot = resolve(__dirname, '..');

function runTreeCommand() {
  try {
    // Ignore cache files, build outputs, dependencies, and other non-essential directories
    const ignorePatterns = [
      '__pycache__',
      '*.pyc',
      'node_modules',
      'dist',
      '.pnpm',
      'coverage',
      '.venv',
      'venv',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '.ruff_cache',
      '.pytest_cache',
      '.tanstack',
      '.webpack',
      '.git',
    ];
    
    const ignoreString = ignorePatterns.join('|');
    const cmd = `tree -a -I '${ignoreString}'`;
    
    console.log('🌳 Running tree command...');
    const output = execSync(cmd, { 
      cwd: repoRoot,
      encoding: 'utf-8' 
    }).trim();
    
    return { cmd, output };
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Error: "tree" command not found. Please install tree first.');
      console.error('   macOS: brew install tree');
      console.error('   Linux: apt install tree or yum install tree');
    } else {
      console.error('❌ Error running tree command:', error.message);
    }
    process.exit(1);
  }
}

function createTreeMdcContent(cmd, treeOutput) {
  return `---
globs: *
alwaysApply: false
---
Below is the file tree structure for this repository

\`\`\`
$ ${cmd}
\`\`\`

${treeOutput}
`;
}

function writeTreeMdc() {
  console.log('🌳 Generating tree.mdc cursor rule...');
  console.log('📂 Repository root:', repoRoot);
  
  // Run tree command
  const { cmd, output } = runTreeCommand();
  
  // Create cursor rules directory
  const cursorRulesDir = resolve(repoRoot, '.cursor', 'rules');
  mkdirSync(cursorRulesDir, { recursive: true });
  
  // Create tree.mdc content
  const mdcContent = createTreeMdcContent(cmd, output);
  
  // Write tree.mdc file
  const treeMdcPath = resolve(cursorRulesDir, 'tree.mdc');
  try {
    writeFileSync(treeMdcPath, mdcContent, 'utf-8');
    console.log('✅ Successfully wrote', treeMdcPath);
    console.log('🎉 Done!');
  } catch (error) {
    console.error('❌ Error writing tree.mdc:', error.message);
    process.exit(1);
  }
}

// Run the script
writeTreeMdc();

