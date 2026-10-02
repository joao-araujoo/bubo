// Free local APK pipeline. No EAS account, cloud build, deployment or store submission.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import {
  assertApiUrl,
  connectedDevices,
  run,
  sdkPackages,
  toolchainPaths,
} from './android-build-lib.mjs';
import { syncBuildWorkspace, windowsBuildWorkspace } from './android-workspace.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobile = path.join(root, 'apps/mobile');
const output = path.join(root, 'build/android');
const apk = path.join(output, 'bubo-test.apk');
const action = process.argv[2] ?? 'build';
const tools = toolchainPaths(root);
const config = JSON.parse(fs.readFileSync(path.join(mobile, 'build.config.json'), 'utf8'));
const catalog = fs.readFileSync(
  path.join(root, 'node_modules/react-native/gradle/libs.versions.toml'),
  'utf8',
);
const packages = sdkPackages(catalog);
const apiUrl = assertApiUrl(process.env.BUBO_BUILD_API_URL ?? config.apiUrl);
const env = {
  ...tools.env,
  EXPO_PUBLIC_API_URL: apiUrl,
  BUBO_BUILD_PROFILE: 'preview',
  NODE_ENV: 'production',
  CI: '1',
  EXPO_NO_TELEMETRY: '1',
};

async function download(item, name) {
  const archive = path.join(tools.defaults, `${name}.zip`);
  fs.mkdirSync(tools.defaults, { recursive: true });
  const checksum = () => createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  if (!fs.existsSync(archive) || checksum() !== item.sha256) {
    console.log(`Baixando ${name} da fonte oficial...`);
    const response = await fetch(item.url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw new Error(`Download ${name}: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archive));
    if (checksum() !== item.sha256) throw new Error(`SHA-256 inválido para ${name}.`);
  }
  return archive;
}

async function extract(archive, destination) {
  await run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '$ErrorActionPreference = "Stop"; Expand-Archive -LiteralPath $env:BUBO_ARCHIVE -DestinationPath $env:BUBO_EXTRACT_DIR -Force',
    ],
    { env: { BUBO_ARCHIVE: archive, BUBO_EXTRACT_DIR: destination } },
  );
}

async function setup() {
  if (!fs.existsSync(tools.javaExecutable) || !fs.existsSync(tools.sdkManager)) {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
      throw new Error(
        'Configure JDK 17 e o SDK Android (JAVA_HOME e ANDROID_HOME). Veja docs/build-mobile.md.',
      );
    }
    if (!fs.existsSync(tools.javaExecutable)) {
      if (process.env.JAVA_HOME)
        throw new Error('JAVA_HOME está configurado, mas não contém bin/java.exe.');
      await extract(await download(tools.manifest.java, 'temurin-jdk-17'), tools.defaults);
    }
    if (!fs.existsSync(tools.sdkManager)) {
      const directory = path.join(tools.sdk, 'cmdline-tools/latest');
      const staging = path.join(tools.defaults, 'command-line-tools');
      await extract(
        await download(tools.manifest.commandLineTools, 'android-command-line-tools'),
        staging,
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.cpSync(path.join(staging, 'cmdline-tools'), directory, { recursive: true });
    }
  }
  if (
    packages.every((item) =>
      fs.existsSync(path.join(tools.sdk, ...item.split(';'), 'source.properties')),
    )
  ) {
    console.log('Java e SDK prontos; reutilizando ferramentas locais.');
    await prepareNativeTools();
    return;
  }
  console.log(
    'Preparando SDK gratuito. Licenças Android: https://developer.android.com/studio/terms',
  );
  await run(tools.sdkManager, [`--sdk_root=${tools.sdk}`, '--licenses'], {
    env: tools.env,
    input: 'y\n'.repeat(100),
    capture: true,
  });
  await run(tools.sdkManager, [`--sdk_root=${tools.sdk}`, ...packages], {
    env: tools.env,
    input: 'y\n'.repeat(100),
  });
  await prepareNativeTools();
}

async function prepareNativeTools() {
  if (process.platform !== 'win32') return;
  const marker = path.join(tools.cmake, '.bubo-ninja-version');
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === tools.manifest.ninja.version)
    return;
  const directory = path.join(tools.defaults, `ninja-${tools.manifest.ninja.version}`);
  await extract(await download(tools.manifest.ninja, 'ninja-windows'), directory);
  // Keep a private CMake installation; never replace binaries in an owner's existing SDK.
  fs.cpSync(path.join(tools.sdk, 'cmake/3.22.1'), tools.cmake, { recursive: true });
  fs.copyFileSync(path.join(directory, 'ninja.exe'), path.join(tools.cmake, 'bin/ninja.exe'));
  fs.writeFileSync(marker, tools.manifest.ninja.version);
}

async function check() {
  console.log(`API do APK: ${apiUrl}\nSDK: ${tools.sdk}\nJava: ${tools.java}`);
  await run(tools.javaExecutable, ['-version'], { env: tools.env });
  for (const item of packages) {
    if (!fs.existsSync(path.join(tools.sdk, ...item.split(';')))) {
      throw new Error(`SDK incompleto (${item}). Rode npm run build:android:setup.`);
    }
  }
  await run(tools.adb, ['version'], { env: tools.env });
  if (process.platform === 'win32') {
    const version = await run(path.join(tools.cmake, 'bin/ninja.exe'), ['--version'], {
      capture: true,
    });
    if (version.trim() !== tools.manifest.ninja.version)
      throw new Error('Ninja local precisa de atualização. Rode npm run build:android:setup.');
    console.log(`Ninja: ${version.trim()}`);
  }
  for (const route of ['health', 'ready']) {
    const response = await fetch(`${apiUrl}/v1/${route}`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`API /v1/${route}: HTTP ${response.status}.`);
    console.log(`API /v1/${route}: OK`);
  }
}

async function install() {
  if (!fs.existsSync(apk)) throw new Error('APK ausente. Rode npm run build:android primeiro.');
  const devices = connectedDevices(
    await run(tools.adb, ['devices'], { env: tools.env, capture: true }),
  );
  const serial = process.env.BUBO_DEVICE_SERIAL ?? (devices.length === 1 ? devices[0] : undefined);
  if (!serial || !devices.includes(serial)) {
    throw new Error(
      'Conecte e autorize um Android via USB. Para vários aparelhos, defina BUBO_DEVICE_SERIAL. Veja docs/build-mobile.md.',
    );
  }
  await run(tools.adb, ['-s', serial, 'install', '-r', apk], { env: tools.env });
  await run(
    tools.adb,
    [
      '-s',
      serial,
      'shell',
      'am',
      'start',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      'bubo:///',
      'com.joaoaraujo.bubo',
    ],
    { env: tools.env },
  );
  console.log('Bubo instalado. Abra Você → Bubo na sua tela para testar os widgets.');
}

async function build() {
  // Full quality gate before generating a binary from this dirty worktree.
  const npm = path.join(
    path.dirname(process.execPath),
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
  );
  await run(npm, ['run', 'verify'], { cwd: root });
  await setup();
  await check();
  let nativeRoot = root;
  if (process.platform === 'win32') {
    nativeRoot = windowsBuildWorkspace(root);
    console.log(`Sincronizando cópia de compilação: ${nativeRoot}`);
    const { installDependencies, lockHash } = syncBuildWorkspace(root, nativeRoot);
    if (installDependencies) {
      await run(npm, ['ci', '--include=dev', '--no-audit', '--no-fund'], { cwd: nativeRoot });
      fs.writeFileSync(path.join(nativeRoot, '.bubo-dependencies.sha256'), lockHash);
    }
  }
  await buildNative(nativeRoot);
}

async function buildNative(nativeRoot) {
  const nativeMobile = path.join(nativeRoot, 'apps/mobile');
  const cli = path.join(nativeRoot, 'node_modules/expo/bin/cli');
  console.log(`Compilando pelo caminho curto: ${nativeMobile}`);
  await run(
    process.execPath,
    [cli, 'prebuild', '--platform', 'android', '--no-install', '--no-clean'],
    {
      cwd: nativeMobile,
      env,
    },
  );
  const android = path.join(nativeMobile, 'android');
  if (process.platform === 'win32') {
    const properties = path.join(android, 'local.properties');
    const existing = fs.existsSync(properties) ? fs.readFileSync(properties, 'utf8') : '';
    fs.writeFileSync(
      properties,
      existing.replace(/^cmake\.dir=.*\r?\n?/gm, '') +
        `\ncmake.dir=${tools.cmake.replaceAll('\\', '/')}\n`,
    );
    // CMake must have room to hash long codegen filenames even with Windows long paths disabled.
    const gradle = path.join(android, 'app/build.gradle');
    const generated = fs
      .readFileSync(gradle, 'utf8')
      .replace(/\n\/\/ Bubo native cache start[\s\S]*?\/\/ Bubo native cache end\n?/g, '');
    const cache = path.join(nativeRoot, 'n/app').replaceAll('\\', '/');
    fs.writeFileSync(
      gradle,
      generated +
        `\n// Bubo native cache start\nandroid.externalNativeBuild.cmake.buildStagingDirectory = file('${cache}')\n// Bubo native cache end\n`,
    );
  }
  // React Native caches absolute module paths. Regenerate only that index when the build root changes.
  const autolinking = path.join(android, 'build/generated/autolinking/autolinking.json');
  if (fs.existsSync(autolinking)) {
    const cached = JSON.parse(fs.readFileSync(autolinking, 'utf8'));
    if (cached.root !== nativeMobile) fs.unlinkSync(autolinking);
  }
  // Preview uses Expo's test keystore; preserve it outside generated native projects.
  const keystore = path.join(tools.defaults, 'bubo-test.keystore');
  const nativeKeystore = path.join(android, 'app/debug.keystore');
  fs.mkdirSync(tools.defaults, { recursive: true });
  if (fs.existsSync(keystore)) fs.copyFileSync(keystore, nativeKeystore);
  else fs.copyFileSync(nativeKeystore, keystore);
  await run(
    path.join(android, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'),
    [
      ':app:assembleRelease',
      '--console=plain',
      '--build-cache',
      '-Dorg.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m',
      `--max-workers=${config.workers}`,
      `-PreactNativeArchitectures=${config.architectures.join(',')}`,
    ],
    { cwd: android, env },
  );
  const source = path.join(android, 'app/build/outputs/apk/release/app-release.apk');
  const buildTools = path.join(
    tools.sdk,
    ...packages.find((item) => item.startsWith('build-tools;')).split(';'),
  );
  const suffix = process.platform === 'win32' ? '.exe' : '';
  await run(
    path.join(buildTools, process.platform === 'win32' ? 'apksigner.bat' : 'apksigner'),
    ['verify', source],
    { env },
  );
  const manifest = await run(
    path.join(buildTools, `aapt${suffix}`),
    ['dump', 'xmltree', source, 'AndroidManifest.xml'],
    { env, capture: true },
  );
  for (const receiver of ['StreakWidget', 'RhythmWidget', 'CalendarWidget', 'ReadingWidget']) {
    if (!manifest.includes(`expo.modules.bubowidgets.${receiver}`))
      throw new Error(`APK sem ${receiver}.`);
  }
  const contents = await run(path.join(buildTools, `aapt${suffix}`), ['list', source], {
    env,
    capture: true,
  });
  if (!contents.includes('assets/index.android.bundle'))
    throw new Error('APK sem JavaScript embarcado.');
  fs.mkdirSync(output, { recursive: true });
  fs.copyFileSync(source, apk);
  const sha256 = createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
  fs.writeFileSync(
    path.join(output, 'build-info.json'),
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        apiUrl,
        architectures: config.architectures,
        signing: 'test-only',
        sha256,
        widgets: ['reading', 'rhythm', 'complete'],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `\nAPK pronto: ${apk}\nSHA-256: ${sha256}\nInstalar por USB: npm run install:android\nOu copie o APK para o celular e abra-o.`,
  );
}

try {
  if (action === 'setup') await setup();
  else if (action === 'check') await check();
  else if (action === 'install') await install();
  else if (action === 'build') await build();
  else throw new Error('Comando inválido: build, setup, check ou install.');
} catch (error) {
  console.error(`\nBuild Android: ${error instanceof Error ? error.message : 'falha inesperada'}`);
  process.exitCode = 1;
}
