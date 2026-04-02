import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultTarget = '/tmp/openshell-nightshift-public'

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.codex',
  '.git',
  '.next',
  '.playwright-cli',
  '.vercel',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'output',
])

const EXCLUDED_FILE_NAMES = new Set([
  '.DS_Store',
  '.env.local',
  '.env',
])

const EXCLUDED_RELATIVE_PATHS = new Set([
  'docs/APRIL_1_SUBMISSION_CHECKLIST.md',
  'docs/RISEIN_FINAL_SUBMIT_INSTRUCTIONS.md',
  'docs/VIDEO_SCRIPT.md',
  'docs/HACKATHON_SUBMISSION.md',
  'docs/SUBMISSION_FORM_ANSWERS.md',
  'scripts/risein-final-submit.js',
])

function shouldSkip(sourcePath, entry) {
  const relativePath = path.relative(rootDir, sourcePath)

  if (entry.name.startsWith('.env.') && entry.name !== '.env.example') {
    return true
  }

  if (EXCLUDED_FILE_NAMES.has(entry.name)) {
    return true
  }

  if (entry.isDirectory() && EXCLUDED_DIRECTORY_NAMES.has(entry.name)) {
    return true
  }

  if (EXCLUDED_RELATIVE_PATHS.has(relativePath)) {
    return true
  }

  if (sourcePath.endsWith('.tsbuildinfo')) {
    return true
  }

  return false
}

function copyTree(sourceDir, targetDir) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
  fs.mkdirSync(targetDir, { recursive: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (shouldSkip(sourcePath, entry)) {
      continue
    }

    if (entry.isDirectory()) {
      copyTree(sourcePath, targetPath)
      continue
    }

    if (entry.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true })
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

function main() {
  const targetDir = path.resolve(process.argv[2] || defaultTarget)
  fs.rmSync(targetDir, { recursive: true, force: true })
  copyTree(rootDir, targetDir)
  console.log(targetDir)
}

main()
