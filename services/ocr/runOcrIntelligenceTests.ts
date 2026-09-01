import { runOcrIntelligenceTestSuite } from './ocrIntelligenceTestSuite.ts';

async function main() {
  const result = await runOcrIntelligenceTestSuite();
  for (const row of result.results) {
    const mark = row.passed ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${row.name}${row.details ? `  — ${row.details}` : ''}`);
  }
  console.log(`\n${result.passed}/${result.passed + result.failed} passed (${result.failed} failed)`);
  if (result.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
