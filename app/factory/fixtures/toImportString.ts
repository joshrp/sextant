#!/usr/bin/env npx tsx
/**
 * Converts test fixture JSON files back into factory import strings.
 *
 * Usage:
 *   npx tsx app/factory/fixtures/toImportString.ts                  # all fixtures
 *   npx tsx app/factory/fixtures/toImportString.ts research-t2-simple  # one fixture
 */
import { readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { compress } from "../importexport/importexport";

const fixturesDir = import.meta.dirname;

async function main() {
  const filter = process.argv[2];

  const files = readdirSync(fixturesDir)
    .filter((f) => f.endsWith(".test.fixture.json"))
    .filter((f) => !filter || f.includes(filter));

  if (files.length === 0) {
    console.error(
      filter
        ? `No fixture files matching "${filter}"`
        : "No fixture files found"
    );
    process.exit(1);
  }

  for (const file of files) {
    const fixture = JSON.parse(readFileSync(join(fixturesDir, file), "utf-8"));
    const name = basename(file, ".test.fixture.json");
    const importString = await compress(fixture.factory);
    console.log(`--- ${name} ---`);
    console.log(importString);
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
