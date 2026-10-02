import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function assertApiUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Configure uma URL HTTPS válida para a API do APK.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname)
  ) {
    throw new Error('O APK de teste precisa de uma API HTTPS pública, sem credenciais na URL.');
  }
  return url.href.replace(/\/$/, '');
}

export function sdkPackages(catalog) {
  const version = (name) => {
    const value = new RegExp(`^${name} = "([^"\\r\\n]+)"`, 'm').exec(catalog)?.[1];
    if (!value || !/^[\d.]+$/.test(value)) throw new Error(`Versão Android ausente: ${name}`);
    return value;
  };
  return [
    'platform-tools',
    `platforms;android-${version('compileSdk')}`,
    `build-tools;${version('buildTools')}`,
    `ndk;${version('ndkVersion')}`,
    'cmake;3.22.1',
  ];
}

export function connectedDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => /^(\S+)\s+device$/.exec(line.trim())?.[1])
    .filter(Boolean);
}

// Pass batch arguments as data to PowerShell; paths/URLs never become shell source.
export function run(command, args, options = {}) {
  const batch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const executable = batch ? 'powershell.exe' : command;
  const argumentsList = batch
    ? [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '$ErrorActionPreference = "Stop"; $buboArguments = ConvertFrom-Json $env:BUBO_BUILD_ARGUMENTS; & $env:BUBO_BUILD_EXECUTABLE @buboArguments; exit $LASTEXITCODE',
      ]
    : args;
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(executable, argumentsList, {
      cwd: options.cwd,
      env: {
        ...process.env,
        DEBUG: '',
        ...options.env,
        ...(batch
          ? { BUBO_BUILD_EXECUTABLE: command, BUBO_BUILD_ARGUMENTS: JSON.stringify(args) }
          : {}),
      },
      windowsHide: true,
      stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : ['pipe', 'inherit', 'inherit'],
    });
    child.stdout?.on('data', (data) => (output += data.toString()));
    child.stderr?.on('data', (data) => (output += data.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${path.basename(command)} falhou (código ${code}).\n${output}`));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(options.input ?? '');
  });
}

export function toolchainPaths(root) {
  const defaults = path.join(
    process.env.LOCALAPPDATA ?? process.env.HOME ?? root,
    'Bubo',
    'Android',
  );
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/android-toolchain.json')));
  const sdk =
    process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(defaults, 'sdk');
  const java = process.env.JAVA_HOME ?? path.join(defaults, manifest.java.directory);
  const windows = process.platform === 'win32';
  return {
    defaults,
    manifest,
    sdk,
    java,
    cmake: path.join(defaults, 'cmake-3.22.1'),
    javaExecutable: path.join(java, 'bin', windows ? 'java.exe' : 'java'),
    sdkManager: path.join(
      sdk,
      'cmdline-tools',
      'latest',
      'bin',
      windows ? 'sdkmanager.bat' : 'sdkmanager',
    ),
    adb: path.join(sdk, 'platform-tools', windows ? 'adb.exe' : 'adb'),
    env: {
      JAVA_HOME: java,
      ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk,
      PATH: `${path.join(java, 'bin')}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  };
}
