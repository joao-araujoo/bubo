import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mobile = path.join(root, 'apps', 'mobile');
const fileEnvironment = {};
for (const name of ['.env', '.env.local']) {
  const file = path.join(mobile, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else value = value.replace(/\s+#.*$/, '');
    fileEnvironment[match[1]] = value;
  }
}
const env = { ...fileEnvironment, ...process.env };
let invalid = false;
const report = (status, text) => console.log(`[${status}] ${text}`);
console.log(
  'Bubo — diagnóstico local de push (somente leitura; sem envio e sem mostrar credenciais).',
);

const projectId = env.BUBO_EAS_PROJECT_ID;
if (!projectId) {
  report(
    'PENDENTE',
    'BUBO_EAS_PROJECT_ID: UUID público do projeto Expo ausente. Esta build não registra push.',
  );
} else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
  invalid = true;
  report('ERRO', 'BUBO_EAS_PROJECT_ID tem formato inválido.');
} else
  report(
    'OK',
    'BUBO_EAS_PROJECT_ID tem formato UUID; associação e credenciais remotas precisam homologação.',
  );

const firebasePath = env.GOOGLE_SERVICES_JSON;
if (!firebasePath) {
  report('PENDENTE', 'GOOGLE_SERVICES_JSON: configuração Firebase Android ausente.');
} else {
  try {
    const file = path.isAbsolute(firebasePath) ? firebasePath : path.resolve(mobile, firebasePath);
    const firebase = JSON.parse(fs.readFileSync(file, 'utf8'));
    const android = firebase.client?.some(
      (client) => client.client_info?.android_client_info?.package_name === 'com.joaoaraujo.bubo',
    );
    if (!android || !firebase.project_info?.project_number) {
      invalid = true;
      report('ERRO', 'Arquivo Firebase não configura o pacote Android oficial e seu sender id.');
    } else report('OK', 'Arquivo Firebase contém o pacote Android oficial e sender id.');
  } catch {
    invalid = true;
    report('ERRO', 'Arquivo GOOGLE_SERVICES_JSON não pôde ser lido/validado.');
  }
}

const manifestPath = path.join(mobile, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  const libraryPath = path.join(
    root,
    'node_modules',
    'expo-notifications',
    'android',
    'src',
    'main',
    'AndroidManifest.xml',
  );
  const library = fs.existsSync(libraryPath) ? fs.readFileSync(libraryPath, 'utf8') : '';
  report(
    (manifest + library).includes('android.permission.POST_NOTIFICATIONS') ? 'OK' : 'PENDENTE',
    'POST_NOTIFICATIONS declarada pelo app/módulo Expo para merge Gradle; conferir o APK compilado.',
  );
} else report('PENDENTE', 'Projeto nativo Android ainda não foi gerado neste checkout.');

report(
  'HOMOLOGAR',
  'Credencial FCM v1 deve estar no projeto Expo; APNs deve corresponder ao bundle iOS oficial. Nenhuma chave privada pertence ao app/repo.',
);
report(
  'HOMOLOGAR',
  'Apple provisioning, entitlement aps-environment e compilação Swift precisam de macOS/Xcode e conta Apple do dono.',
);
report(
  'HOMOLOGAR',
  'Android/iPhone: permissão, tela bloqueada, app fechado, tap, conta trocada, revogação e recibos Expo.',
);
report(
  'INFO',
  'APK local não exige EAS Build pago. O serviço de push ainda precisa do UUID Expo e credenciais FCM/APNs.',
);
console.log('Roteiro completo: docs/notifications.md');
if (invalid) process.exitCode = 1;
