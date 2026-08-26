import * as fs from 'fs';
import * as path from 'path';
import { PERMISSION_KEYS } from './permissions';

function* walkControllers(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkControllers(full);
    } else if (entry.isFile() && entry.name.endsWith('.controller.ts')) {
      yield full;
    }
  }
}

describe('RBAC permission completeness', () => {
  it('every @RequirePermissions string is defined in PERMISSION_DEFINITIONS', () => {
    const controllersDir = path.join(__dirname, '..', '..');
    const used = new Map<string, string[]>();

    for (const file of walkControllers(controllersDir)) {
      const content = fs.readFileSync(file, 'utf8');
      const re = /@RequirePermissions\(([^)]*)\)/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const keys = match[1]
          .split(',')
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter((s) => s.length > 0);
        for (const key of keys) {
          const rel = path.relative(controllersDir, file);
          if (!used.has(key)) used.set(key, []);
          used.get(key)!.push(rel);
        }
      }
    }

    expect(used.size).toBeGreaterThan(0);

    const missing = [...used.keys()].filter((key) => !PERMISSION_KEYS.includes(key));
    if (missing.length > 0) {
      const detail = missing
        .map((key) => `${key} (used in: ${used.get(key)!.join(', ')})`)
        .join('; ');
      throw new Error(
        `Controller permissions not defined in src/common/constants/permissions.ts — the seed would leave them unassigned and every role would get 403: ${detail}`,
      );
    }
  });
});
