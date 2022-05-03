import JestHasteMap from 'jest-haste-map';
import { cpus } from 'os';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import yargs from 'yargs';
import Resolver from 'jest-resolve';
import { DependencyResolver } from 'jest-resolve-dependencies';
 
// Get the root path to our project (Like `__dirname`).
// instead of __dirname in es module mode
const root = join(dirname(fileURLToPath(import.meta.url)), 'product');

const hasteMapOptions = {
  extensions: ['js'],
  maxWorkers: cpus().length,
  name: 'jest-bundler',
  platforms: [],
  rootDir: root,
  roots: [root],
};
// Need to use `.default` as of Jest 27.
const hasteMap = new JestHasteMap.default(hasteMapOptions);
// This line is only necessary in `jest-haste-map` version 28 or later.
await hasteMap.setupCachePath(hasteMapOptions);
const { hasteFS, moduleMap } = await hasteMap.build();
console.log(hasteFS.getAllFiles());
// ['/path/to/product/apple.js', '/path/to/product/banana.js', …]

//@Note run with argv for entry-point: node index.mjs --entry-point product/entry-point.js
const options = yargs(process.argv).argv;
const entryPoint = resolve(process.cwd(), options.entryPoint);
if (!hasteFS.exists(entryPoint)) {
  throw new Error(
    '`--entry-point` does not exist. Please provide a path to a valid file.',
  );
}
console.log(chalk.bold(`❯ Building ${chalk.blue(options.entryPoint)}`));

// get the dependencies of the file that we pass in argv as entry-point
console.log(hasteFS.getDependencies(entryPoint));


const resolver = new Resolver.default(moduleMap, {
    extensions: ['.js'],
    hasCoreModules: false,
    rootDir: root,
  });
const dependencyResolver = new DependencyResolver(resolver, hasteFS);

console.log(dependencyResolver.resolve(entryPoint));
// ['/path/to/apple.js']

/////////// BUILD DEPENDENCY GRAPH /////////////////

const allFiles = new Set();
const queue = [entryPoint];
while (queue.length) {
  const module = queue.shift();
  // Ensure we process each module at most once
  // to guard for cycles.
  if (allFiles.has(module)) {
    continue;
  }
 
  allFiles.add(module);
  queue.push(...dependencyResolver.resolve(module));
}
 
console.log(chalk.bold(`❯ Found ${chalk.blue(allFiles.size)} files`));
console.log(Array.from(allFiles));
// ['/path/to/entry-point.js', '/path/to/apple.js', …]


/////////// SERIALIZE /////////////

console.log(chalk.bold(`❯ Serializing bundle`));
const allCode = [];
await Promise.all(
  Array.from(allFiles).map(async (file) => {
    const code = await fs.promises.readFile(file, 'utf8');
    allCode.push(code);
  }),
);
console.log(allCode.join('\n'));
