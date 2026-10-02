import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  assertApiUrl,
  connectedDevices,
  sdkPackages,
  run,
} from '../../../scripts/android-build-lib.mjs';
import { syncBuildWorkspace } from '../../../scripts/android-workspace.mjs';

describe('installable local Android builds', () => {
  it('synchronizes fresh sources and deletions while excluding secrets and preserving native caches', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bubo-stage-'));
    const source = path.join(temporary, 'source');
    const stage = path.join(temporary, 'stage');
    const write = (relative, text) => {
      const file = path.join(source, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text);
    };
    try {
      write('package.json', '{}');
      write('package-lock.json', '{}');
      write('apps/mobile/src/screen.tsx', 'original');
      write('apps/mobile/.env', 'private');
      write('apps/api/.dev.vars', 'private');
      write('apps/api/.local/account', 'private');
      expect(syncBuildWorkspace(source, stage).installDependencies).toBe(true);
      expect(fs.readFileSync(path.join(stage, 'apps/mobile/src/screen.tsx'), 'utf8')).toBe(
        'original',
      );
      for (const name of ['apps/mobile/.env', 'apps/api/.dev.vars', 'apps/api/.local/account']) {
        expect(fs.existsSync(path.join(stage, name))).toBe(false);
      }
      fs.mkdirSync(path.join(stage, 'apps/mobile/android'), { recursive: true });
      fs.writeFileSync(path.join(stage, 'apps/mobile/android/cache'), 'retained');
      write('apps/mobile/src/screen.tsx', 'updated');
      syncBuildWorkspace(source, stage);
      expect(fs.readFileSync(path.join(stage, 'apps/mobile/src/screen.tsx'), 'utf8')).toBe(
        'updated',
      );
      fs.unlinkSync(path.join(source, 'apps/mobile/src/screen.tsx'));
      syncBuildWorkspace(source, stage);
      expect(fs.existsSync(path.join(stage, 'apps/mobile/src/screen.tsx'))).toBe(false);
      expect(fs.readFileSync(path.join(stage, 'apps/mobile/android/cache'), 'utf8')).toBe(
        'retained',
      );
      expect(() => syncBuildWorkspace(source, path.join(source, 'nested'))).toThrow();
      expect(() => syncBuildWorkspace(path.join(temporary, 'another-source'), stage)).toThrow();
    } finally {
      if (path.dirname(path.resolve(temporary)) === path.resolve(os.tmpdir())) {
        fs.rmSync(temporary, { recursive: true, force: true });
      }
    }
  });
  it.skipIf(process.platform !== 'win32')(
    'preserves separate batch arguments and paths with spaces on Windows',
    async () => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bubo build args '));
      const batch = path.join(directory, 'arguments.cmd');
      fs.writeFileSync(
        batch,
        '@echo off\r\nnode -e "process.stdout.write(JSON.stringify(process.argv.slice(1)))" %*\r\n',
      );
      try {
        const output = await run(batch, ['first argument', 'second argument'], { capture: true });
        expect(JSON.parse(output)).toEqual(['first argument', 'second argument']);
      } finally {
        fs.unlinkSync(batch);
        fs.rmdirSync(directory);
      }
    },
  );
  it('accepts a public HTTPS endpoint with a deployment path', () => {
    expect(assertApiUrl('https://api.example.com/bubo/')).toBe('https://api.example.com/bubo');
  });

  it.each([
    'http://api.example.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://[::1]',
    'https://user:password@api.example.com',
    'https://api.example.com?token=value',
    'https://api.example.com#secret',
    '',
  ])('rejects an unsafe or unusable packaged API URL: %s', (url) => {
    expect(() => assertApiUrl(url)).toThrow();
  });

  it('takes SDK/NDK versions from the installed React Native instead of silently upgrading', () => {
    const catalog =
      '[versions]\ncompileSdk = "36"\nbuildTools = "36.0.0"\nndkVersion = "27.1.12297006"';
    expect(sdkPackages(catalog)).toContain('platforms;android-36');
    expect(sdkPackages(catalog)).toContain('ndk;27.1.12297006');
    expect(() => sdkPackages('[versions]\ncompileSdk = "36"')).toThrow();
  });

  it('never selects unauthorized or offline devices for installation', () => {
    expect(
      connectedDevices(
        'List of devices attached\nUSB1\tunauthorized\nUSB2\toffline\nUSB3\tdevice\nemulator-5554\tdevice\n',
      ),
    ).toEqual(['USB3', 'emulator-5554']);
    expect(connectedDevices('List of devices attached\n')).toEqual([]);
  });
});
