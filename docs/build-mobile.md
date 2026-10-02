# Build gratuito para testar no celular

## Android: um comando

Na pasta principal do Bubo, com Node e as dependências já instalados:

```powershell
npm run build:android
```

O comando valida o projeto com `npm run verify`, prepara Java e o SDK no Windows 64 bits,
confere a API, gera o projeto nativo com os assets oficiais e compila um APK independente.
Verifica a assinatura, os três receptores de widgets e o JavaScript dentro do APK antes de
entregar **`build/android/bubo-test.apk`**. `build-info.json` registra data, API, arquiteturas
e SHA-256. Nenhuma conta Expo, cartão, assinatura, EAS, loja ou serviço de CI é necessário.

**Primeira vez:** precisa de internet, vários GB livres e tempo para baixar SDK/NDK e dependências.
Nas seguintes, ferramentas e caches são reaproveitados; não é feito `clean`. Os dois processadores
Gradle limitam o paralelismo; a JVM usa até 2 GB de heap e 1 GB de metaspace. O APK cobre ARM64
e ARMv7 (celulares Android).

**Instale de um destes jeitos:**

1. Copie `build/android/bubo-test.apk` para o celular e abra-o. Quando solicitado, permita
   instalar apps dessa fonte. Abra o Bubo e entre na sua conta.
2. Ou ative **Opções do desenvolvedor → Depuração USB**, conecte o cabo, aceite a autorização
   no celular e rode:

   ```powershell
   npm run install:android
   ```

   O comando atualiza o app preservando seus dados e abre o Bubo. Só instala se houver um aparelho
   autorizado. Com vários aparelhos, selecione um com `$env:BUBO_DEVICE_SERIAL='serial-do-adb'`.
   Se houver erro de assinatura por uma instalação anterior de outra origem, não desinstalamos
   automaticamente: a desinstalação apaga dados locais e sessões ainda não enviadas.

O APK roda sem Metro, Expo Go ou computador ligado. Precisa de internet para falar com a API.
Widgets não precisam de Firebase nem push. Push remoto ainda depende de configurar Firebase/EAS;
reset de senha e outras integrações têm os limites registrados em [CONFIGURAR.md](../CONFIGURAR.md).

## Conferir os widgets

Abra **Você → Bubo na sua tela**, ligue a atualização e adicione um modelo. Ou toque e segure
uma área vazia da tela inicial → **Widgets → Bubo**. Teste os três, redimensione e conclua uma
sessão para ver página/dias atualizados. Toque no widget para abrir o app; saia da conta para
conferir que os dados somem. Roteiro completo: [TESTAR-TELAS.md, seção 6c](TESTAR-TELAS.md#6c-widgets-android-e-ios-task-09-adr-023).

## Ferramentas e configuração

- `npm run build:android:setup`: só prepara as ferramentas; pode repetir.
- `npm run build:android:check`: confere Java, SDK, adb e `/v1/health` + `/v1/ready` da API.
- `npm run build:android`: valida e compila.
- `npm run install:android`: instala o APK existente por USB, sem recompilar.

O instalador Windows baixa JDK Temurin 17 e Android command-line tools dos fornecedores,
verifica SHA-256 e instala em `%LOCALAPPDATA%\Bubo\Android`. Não altera PATH global nem exige
administrador/Android Studio. O uso do SDK aceita as [licenças Android](https://developer.android.com/studio/terms).
As versões de plataforma, Build Tools e NDK vêm do React Native instalado pelo lockfile.
As URLs/checksums das ferramentas ficam em `scripts/android-toolchain.json`; novas versões
só entram por uma atualização deliberada e validada.

O build usa uma cópia privada do CMake com Ninja 1.13.2 (download oficial com SHA-256),
porque o Ninja antigo do SDK falha em caminhos gerados maiores que 260 caracteres. Não altera
o registro do Windows nem substitui ferramentas de um SDK externo já instalado.
O cache C++ do app também vai para uma pasta curta dentro dessa cópia, para o CMake conseguir
reduzir os nomes longos gerados pelas dependências sem habilitar caminhos longos no Windows.

No Windows, o comando sincroniza uma cópia de compilação em `C:\BuboBuild\<id-do-projeto>`
(na unidade do projeto), com dependências próprias instaladas pelo mesmo lockfile. Mantém o
cache entre execuções, atualiza fontes alteradas e remove da cópia fontes que você apagou.
Não copia `.env`, `.dev.vars`, contas locais, chaves ou configurações Firebase. Nada é movido
ou renomeado na pasta original. Uma pasta existente sem o marcador do Bubo é recusada.
Isso evita os caminhos longos/com espaços do CMake/Ninja descritos no
[guia oficial do Reanimated para Windows](https://docs.swmansion.com/react-native-reanimated/docs/guides/building-on-windows/).

Se você já tem ferramentas, defina `JAVA_HOME` para JDK 17 e `ANDROID_HOME` para seu SDK (com
`cmdline-tools/latest`). Isso também permite compilar em Linux/macOS; o download automático
é específico do Windows x64. [Expo: builds locais](https://docs.expo.dev/guides/local-app-overview/).

`apps/mobile/build.config.json` tem apenas valores públicos: API, arquiteturas e paralelismo.
A API padrão é a já existente `https://bubo-api.bubo-api.workers.dev`; o build não muda sua `.env`.
Para outra API HTTPS:

```powershell
$env:BUBO_BUILD_API_URL='https://sua-api.example.com'
npm run build:android
```

O endpoint precisa implementar os contratos atuais do Bubo. O build checa disponibilidade,
mas cadastro, login e widgets com dados reais precisam do teste no seu aparelho.
**Build gratuito não garante capacidade ilimitada do backend:** não contratamos plano pago
nem mudamos Cloudflare/Neon. Veja os limites de autenticação já registrados em [release.md](release.md).

## iPhone e publicação futura

Este Windows compila Android. iOS precisa de Mac/Xcode. O simulador no Mac permite testar
WidgetKit sem assinatura de distribuição, com `npm run ios --workspace @bubo/mobile`.
Para os widgets no **iPhone físico**, configure a assinatura de ambos os targets e o App Group
compartilhado entre app e extensão em uma equipe Apple. A matriz atual da Apple lista App Groups
também para contas gratuitas; o provisionamento precisa ser confirmado no Xcode da sua conta.
Veja a [matriz oficial de capacidades Apple](https://developer.apple.com/help/account/reference/supported-capabilities-ios/).
Este ambiente Windows não gera nem valida um binário para instalar no iPhone.

O APK é **para teste**, com a chave de teste do template Expo, preservada localmente fora do
projeto gerado. Não é um artefato para Google Play. Para lojas, use uma chave privada de
produção e gere AAB seguindo [Expo: build de produção local](https://docs.expo.dev/guides/local-app-production/),
defina versões e separe a API/banco de desenvolvimento dos de produção. A infraestrutura atual
preserva esse caminho sem exigir contas de loja ou serviços extras para o teste de hoje.
O script usa `prebuild --no-clean` explicitamente (SDK 57 recria os projetos por padrão).
Não use `prebuild --clean` para acelerar: isso descarta projetos/cache nativos gerados.

Compilação, assinatura e presença dos widgets no APK são verificáveis no computador.
Funcionamento visual no launcher e nos aparelhos continua sendo um aceite separado.

**Verificado em 2026-10-01:** `npm run verify` passou (330 testes); APK Android compilado
nas duas arquiteturas, assinatura validada, três receptores de widgets e bundle embarcado
confirmados. `/v1/health` e `/v1/ready` responderam 200. Nenhum celular estava conectado;
instalação, login e aparência/atualização dos widgets no launcher aguardam seu teste.
