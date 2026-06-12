import path from 'node:path';
import { cp, mkdir, readFile } from 'node:fs/promises';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const templateMapPath = path.join(repoRoot, 'scripts/customer-delivery-template-map.json');

const templateMap = JSON.parse(await readFile(templateMapPath, 'utf8'));

for (const rule of templateMap.rules ?? []) {
  if (rule.type === 'mirror') {
    const sourceRoot = path.join(repoRoot, rule.src);
    const destinationRoot = path.join(repoRoot, rule.dst);
    await mkdir(destinationRoot, { recursive: true });

    if (Array.isArray(rule.include) && rule.include.length > 0) {
      for (const relativePath of rule.include) {
        await cp(
          path.join(sourceRoot, relativePath),
          path.join(destinationRoot, relativePath),
          { force: true, recursive: false },
        );
      }
      continue;
    }

    await cp(sourceRoot, destinationRoot, {
      force: true,
      recursive: true,
    });
    continue;
  }

  if (rule.type === 'preserve') {
    continue;
  }

  throw new Error(`Unsupported rule type: ${rule.type}`);
}
