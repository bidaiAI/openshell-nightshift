import { buildBetaEnvFiles } from './lib/beta-env.mjs'

const files = buildBetaEnvFiles()

for (const [name, result] of Object.entries(files)) {
  console.log(`${name}: ${result.created ? 'created' : 'reused'} ${result.filePath}`)
}

console.log('\nBeta environment files are ready.')
console.log('Next step: run `pnpm beta` to start API, web, and worker together.')
