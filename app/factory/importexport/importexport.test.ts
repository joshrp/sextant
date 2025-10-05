import { describe, expect, test } from 'vitest';
import '@ungap/compression-stream/poly';
import * as imex from "./importexport";
import testFactories from "./testFactories.json";
import testExports from "./testExports.json";
import type { GraphCoreData } from '../store';

describe.each(Object.entries(testFactories))('Exporting %s', (key, data) => {
  test(`Basic export`, async () => {
    const str = imex.getBasicB64(data);
    expect(str).toMatchSnapshot();
    console.log(key, "String length:", str.length);
  });
  test('Minify', async () => {
    const min = imex.minify(data as GraphCoreData);
    expect(min).toMatchSnapshot();
    console.log(key, "Minified:", JSON.stringify(min).length);
  });
  test('Minify and compress, decompress', async () => {
    console.log(key, "Minify and compress");
    const min = imex.minify(data as GraphCoreData);
    const compressed = await imex.compress(min);
    expect(compressed).toMatchSnapshot();
    const decompressed = await imex.decompress(compressed);
    expect(decompressed).toEqual(min);
  });
});

describe.each(Object.entries(testExports['version-1']))('Importing %s', (key, data) => {
  test('Decompress and unminify $1', async () => {
    console.log(key, "Decompress and unminify");
    if (typeof data !== "string") throw new Error("Test data is not a string");
    const decompressed = await imex.decompress(data);
    expect(decompressed).toMatchSnapshot();
    const core = imex.unminify(decompressed);
    expect(core).toMatchSnapshot();
  });
});
