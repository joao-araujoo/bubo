const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const {
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const TARGET = 'BuboWidgetsExtension';
// Must match WIDGET_POSES in @bubo/contracts (checked by widget-native-generation.test.ts).
const POSES = [
  'welcome',
  'happy',
  'reading',
  'review',
  'celebrating',
  'achievement',
  'cheering',
  'worried',
  'surprised',
  'sleeping',
  'doubt',
  'curious',
  'confident',
  'thinking',
  'deep-reading',
];
// Must match WIDGET_KINDS in @bubo/contracts.
const KINDS = ['streak', 'rhythm', 'calendar', 'reading', 'league'];
/** Plus Jakarta Sans weights used by the widgets: [token, file]. */
const FONTS = [
  ['regular', 'PlusJakartaSans_400Regular.ttf'],
  ['medium', 'PlusJakartaSans_500Medium.ttf'],
  ['semibold', 'PlusJakartaSans_600SemiBold.ttf'],
  ['bold', 'PlusJakartaSans_700Bold.ttf'],
  ['extrabold', 'PlusJakartaSans_800ExtraBold.ttf'],
];
/** Android resource names cannot contain "-": `deep-reading` → bubo_widget_deep_reading. */
const poseResource = (pose) => `bubo_widget_${pose.replaceAll('-', '_')}`;

const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const copy = (source, target) => {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
};

// Generate native tokens from the canonical theme, never maintain a second colour palette.
function readTheme(root) {
  const source = fs.readFileSync(path.join(root, 'src/theme/colors.ts'), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(js, context);
  return context.exports;
}

/*
 * Icon geometry shared by both platforms (24 × 24 viewport). Every shape is a list of absolute
 * commands (M x y, L x y, Q x1 y1 x y, C x1 y1 x2 y2 x y, Z): Android gets a Kotlin float array
 * and iOS a Swift literal of the same numbers. Simple icons only; never the mascot.
 */
const round = (value) => Math.round(value * 100) / 100;
function circle(cx, cy, r) {
  const k = 0.5523 * r;
  return [
    ['M', cx, cy - r],
    ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    ['Z'],
  ];
}
function polygon(points) {
  return [['M', ...points[0]], ...points.slice(1).map((point) => ['L', ...point]), ['Z']];
}
const rotate = ([x, y], degrees, [cx, cy] = [12, 12]) => {
  const a = (degrees * Math.PI) / 180;
  return [
    cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
    cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
  ];
};

const ICONS = {
  /** Streak flame: outer body and inner glow. */
  flameOuter: [
    ['M', 12, 1.6],
    ['C', 12, 1.6, 19.6, 7.2, 19.6, 14.2],
    ['C', 19.6, 18.8, 16.2, 22.4, 12, 22.4],
    ['C', 7.8, 22.4, 4.4, 18.8, 4.4, 14.2],
    ['C', 4.4, 11, 6.1, 8.7, 7.7, 7.5],
    ['C', 7.8, 9.9, 8.9, 11.4, 10.2, 11.8],
    ['C', 9.6, 7.6, 12, 1.6, 12, 1.6],
    ['Z'],
  ],
  flameInner: [
    ['M', 12, 11.6],
    ['C', 12, 11.6, 15.9, 14.4, 15.9, 17.4],
    ['C', 15.9, 19.6, 14.1, 21.2, 12, 21.2],
    ['C', 9.9, 21.2, 8.1, 19.6, 8.1, 17.4],
    ['C', 8.1, 15.4, 9.6, 14.2, 10.4, 13.8],
    ['C', 10.6, 14.9, 11.2, 15.6, 11.9, 15.8],
    ['C', 11.5, 14.2, 12, 11.6, 12, 11.6],
    ['Z'],
  ],
  /** White "!" of the at-risk badge (fill). */
  alertMark: [
    ['M', 10.6, 5.6],
    ['L', 13.4, 5.6],
    ['L', 12.9, 13.6],
    ['L', 11.1, 13.6],
    ['Z'],
    ...circle(12, 17.2, 1.6),
  ],
  /** Strokes. */
  check: [
    ['M', 7.2, 12.4],
    ['L', 10.4, 15.6],
    ['L', 16.8, 9.2],
  ],
  chevron: [
    ['M', 9.5, 6.5],
    ['L', 15, 12],
    ['L', 9.5, 17.5],
  ],
  snowflake: [0, 60, 120].flatMap((turn) => {
    const arm = [
      ['M', ...rotate([12, 3.5], turn)],
      ['L', ...rotate([12, 20.5], turn)],
    ];
    const ticks = [
      [
        [9.4, 5.2],
        [12, 7.6],
        [14.6, 5.2],
      ],
      [
        [9.4, 18.8],
        [12, 16.4],
        [14.6, 18.8],
      ],
    ].flatMap((tick) => [
      ['M', ...rotate(tick[0], turn)],
      ['L', ...rotate(tick[1], turn)],
      ['L', ...rotate(tick[2], turn)],
    ]);
    return [...arm, ...ticks];
  }),
  clock: [...circle(12, 12, 8.6), ['M', 12, 7.4], ['L', 12, 12.2], ['L', 15.2, 14.2]],
  trophyHandles: [
    ['M', 6.6, 6.2],
    ['L', 3.8, 6.2],
    ['C', 3.8, 9.6, 5.2, 11.2, 7.4, 11.6],
    ['M', 17.4, 6.2],
    ['L', 20.2, 6.2],
    ['C', 20.2, 9.6, 18.8, 11.2, 16.6, 11.6],
  ],
  /** Fills. */
  trophy: [
    ['M', 6.2, 3.6],
    ['L', 17.8, 3.6],
    ['L', 17.8, 9],
    ['C', 17.8, 12.4, 15.2, 15, 12, 15],
    ['C', 8.8, 15, 6.2, 12.4, 6.2, 9],
    ['Z'],
    ...polygon([
      [10.7, 14.6],
      [13.3, 14.6],
      [13.3, 17.8],
      [10.7, 17.8],
    ]),
    ...polygon([
      [7.4, 17.8],
      [16.6, 17.8],
      [16.6, 20.6],
      [7.4, 20.6],
    ]),
  ],
  arrowUp: polygon([
    [12, 5.5],
    [20.5, 17.5],
    [3.5, 17.5],
  ]),
  arrowDown: polygon([
    [3.5, 6.5],
    [20.5, 6.5],
    [12, 18.5],
  ]),
  equal: [
    ...polygon([
      [5, 8.6],
      [19, 8.6],
      [19, 11],
      [5, 11],
    ]),
    ...polygon([
      [5, 13.4],
      [19, 13.4],
      [19, 15.8],
      [5, 15.8],
    ]),
  ],
  /** League badge: a hexagon, a lighter inner hexagon and a gem with a shine. */
  badge: polygon([-90, -30, 30, 90, 150, 210].map((a) => rotate([12, 1], a + 90))),
  badgeInner: polygon([-90, -30, 30, 90, 150, 210].map((a) => rotate([12, 3.2], a + 90))),
  gemCut: polygon([
    [7.2, 10.2],
    [9.6, 7.2],
    [14.4, 7.2],
    [16.8, 10.2],
    [12, 16.8],
  ]),
  gemShine: polygon([
    [9.6, 7.2],
    [12, 10.2],
    [14.4, 7.2],
  ]),
};

function swiftOps(ops) {
  const codes = { M: 0, L: 1, Q: 2, C: 3, Z: 4 };
  return `[${ops.flatMap(([command, ...values]) => [codes[command], ...values.map(round)]).join(', ')}]`;
}
const kotlinOps = (ops) =>
  `floatArrayOf(${ops
    .flatMap(([command, ...values]) => [
      { M: 0, L: 1, Q: 2, C: 3, Z: 4 }[command],
      ...values.map(round),
    ])
    .map((value) => `${value}f`)
    .join(', ')})`;
const kotlinColor = (hex) => `0xFF${hex.slice(1).toUpperCase()}.toInt()`;
const camel = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());

const shape = (body) =>
  `<shape xmlns:android="http://schemas.android.com/apk/res/android" ${body}</shape>\n`;

function generateAndroid(root) {
  const main = path.join(root, 'modules/bubo-widgets/android/src/main');
  const res = path.join(main, 'res');
  const { widgetPalette, coverPalettes } = readTheme(root);
  for (const pose of POSES)
    copy(
      path.join(root, `assets/mascot/bubo-${pose}.png`),
      path.join(res, `drawable-nodpi/${poseResource(pose)}.png`),
    );
  // RemoteViews ignore android:fontFamily="@font/…", so the widgets draw text on a Canvas with
  // the official files loaded from the module's assets (ADR-029).
  for (const [, file] of FONTS)
    copy(path.join(root, 'assets/fonts', file), path.join(main, `assets/bubo-widgets/${file}`));
  const kotlin = `// Generated by plugins/with-bubo-widgets.config.cjs from src/theme/colors.ts. Do not edit.
package expo.modules.bubowidgets

internal object BuboTokens {
${Object.entries(widgetPalette)
  .map(([key, hex]) => `  val ${camel(key)} = ${kotlinColor(hex)}`)
  .join('\n')}
  val coverFace = intArrayOf(${coverPalettes.map((c) => kotlinColor(c.face)).join(', ')})
  val coverSpine = intArrayOf(${coverPalettes.map((c) => kotlinColor(c.spine)).join(', ')})
  val coverText = intArrayOf(${coverPalettes.map((c) => kotlinColor(c.text)).join(', ')})
  val coverAccent = intArrayOf(${coverPalettes.map((c) => kotlinColor(c.accent)).join(', ')})
  val fonts = mapOf(${FONTS.map(([name, file]) => `"${name}" to "bubo-widgets/${file}"`).join(', ')})
${Object.entries(ICONS)
  .map(([name, ops]) => `  val ${name} = ${kotlinOps(ops)}`)
  .join('\n')}
}
`;
  write(path.join(main, 'java/expo/modules/bubowidgets/BuboTokens.kt'), kotlin);
  const drawable = (name, text) => write(path.join(res, `drawable/${name}.xml`), text);
  // Root background (shown while the first bitmap renders) and picker-preview pieces.
  drawable(
    'bubo_widget_surface',
    shape(
      `android:shape="rectangle"><gradient android:angle="270" android:startColor="${widgetPalette.surface}" android:endColor="${widgetPalette.surfaceEnd}"/><corners android:radius="24dp"/>`,
    ),
  );
  drawable(
    'bubo_widget_league_surface',
    shape(
      `android:shape="rectangle"><gradient android:angle="270" android:startColor="${widgetPalette.leagueTop}" android:endColor="${widgetPalette.leagueBottom}"/><corners android:radius="24dp"/>`,
    ),
  );
  drawable(
    'bubo_preview_bar',
    shape(
      `android:shape="rectangle"><solid android:color="${widgetPalette.empty}"/><corners android:radius="6dp"/>`,
    ),
  );
  drawable(
    'bubo_preview_accent',
    shape(
      `android:shape="rectangle"><solid android:color="${widgetPalette.flame}"/><corners android:radius="6dp"/>`,
    ),
  );
  drawable(
    'bubo_preview_purple',
    shape(
      `android:shape="rectangle"><solid android:color="${widgetPalette.purpleLight}"/><corners android:radius="6dp"/>`,
    ),
  );
  drawable(
    'bubo_preview_dot',
    shape(`android:shape="oval"><solid android:color="${widgetPalette.empty}"/>`),
  );
  drawable(
    'bubo_preview_dot_done',
    shape(`android:shape="oval"><solid android:color="${widgetPalette.flame}"/>`),
  );
  drawable(
    'bubo_preview_avatar',
    shape(
      `android:shape="oval"><solid android:color="${widgetPalette.avatar}"/><stroke android:width="2dp" android:color="${widgetPalette.podium}"/>`,
    ),
  );
  drawable(
    'bubo_preview_step',
    shape(
      `android:shape="rectangle"><solid android:color="${widgetPalette.podium}"/><corners android:topLeftRadius="8dp" android:topRightRadius="8dp"/>`,
    ),
  );
  const pathData = (ops) =>
    ops.map(([command, ...values]) => command + values.map(round).join(',')).join(' ');
  drawable(
    'bubo_preview_flame',
    `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n  <path android:fillColor="${widgetPalette.flame}" android:pathData="${pathData(ICONS.flameOuter)}"/>\n  <path android:fillColor="${widgetPalette.flameGlow}" android:pathData="${pathData(ICONS.flameInner)}"/>\n</vector>\n`,
  );
  const sizes = {
    streak: { width: 110, height: 110, cellsW: 2, cellsH: 2 },
    rhythm: { width: 250, height: 110, cellsW: 4, cellsH: 2 },
    calendar: { width: 250, height: 140, cellsW: 4, cellsH: 2 },
    reading: { width: 250, height: 110, cellsW: 4, cellsH: 2 },
    league: { width: 250, height: 110, cellsW: 4, cellsH: 2 },
  };
  for (const kind of KINDS) {
    const size = sizes[kind];
    write(
      path.join(res, `xml/bubo_${kind}_widget.xml`),
      `<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="${size.width}dp" android:minHeight="${size.height}dp"
  android:minResizeWidth="110dp" android:minResizeHeight="110dp"
  android:targetCellWidth="${size.cellsW}" android:targetCellHeight="${size.cellsH}"
  android:updatePeriodMillis="1800000" android:initialLayout="@layout/bubo_widget_canvas"
  android:previewLayout="@layout/bubo_preview_${kind}" android:resizeMode="horizontal|vertical"
  android:description="@string/bubo_widget_${kind}_description"
  android:widgetCategory="home_screen" />\n`,
    );
  }
}

function generateIos(root, platformRoot, bundleId, version) {
  const directory = path.join(platformRoot, TARGET);
  const group = `group.${bundleId}.widgets`;
  const { widgetPalette, coverPalettes } = readTheme(root);
  const color = (hex) => `Color(hex: "${hex}")`;
  const swift = `import SwiftUI
// Generated by plugins/with-bubo-widgets.config.cjs from src/theme/colors.ts. Do not edit.
enum BuboTokens {
${Object.entries(widgetPalette)
  .map(([key, hex]) => `  static let ${camel(key)} = ${color(hex)}`)
  .join('\n')}
  static let coverFace: [Color] = [${coverPalettes.map((c) => color(c.face)).join(', ')}]
  static let coverSpine: [Color] = [${coverPalettes.map((c) => color(c.spine)).join(', ')}]
  static let coverText: [Color] = [${coverPalettes.map((c) => color(c.text)).join(', ')}]
  static let coverAccent: [Color] = [${coverPalettes.map((c) => color(c.accent)).join(', ')}]
${Object.entries(ICONS)
  .map(([name, ops]) => `  static let ${name}: [Double] = ${swiftOps(ops)}`)
  .join('\n')}
}
extension Color {
  init(hex: String) {
    let value = UInt64(hex.dropFirst(), radix: 16) ?? 0
    self.init(.sRGB, red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255, opacity: 1)
  }
}
`;
  write(path.join(directory, 'BuboTokens.swift'), swift);
  copy(
    path.join(root, 'native-widgets/BuboWidgets.swift'),
    path.join(directory, 'BuboWidgets.swift'),
  );
  const assets = path.join(directory, 'Assets.xcassets');
  write(
    path.join(assets, 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }),
  );
  for (const pose of POSES) {
    const image = path.join(assets, `bubo-${pose}.imageset`);
    copy(path.join(root, `assets/mascot/bubo-${pose}.png`), path.join(image, 'mascot.png'));
    write(
      path.join(image, 'Contents.json'),
      JSON.stringify({
        images: [{ filename: 'mascot.png', idiom: 'universal' }],
        info: { author: 'xcode', version: 1 },
      }),
    );
  }
  const fontFiles = FONTS.map(([, file]) => file);
  fontFiles.forEach((font) =>
    copy(path.join(root, 'assets/fonts', font), path.join(directory, font)),
  );
  const header =
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n';
  write(
    path.join(directory, `${TARGET}-Info.plist`),
    `${header}<plist version="1.0"><dict>
<key>CFBundleDisplayName</key><string>Bubo</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>XPC!</string>
<key>CFBundleShortVersionString</key><string>${version}</string>
<key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
<key>BuboAppGroup</key><string>${group}</string>
<key>UIAppFonts</key><array>${fontFiles.map((font) => `<string>${font}</string>`).join('')}</array>
<key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
</dict></plist>\n`,
  );
  write(
    path.join(directory, `${TARGET}.entitlements`),
    `${header}<plist version="1.0"><dict><key>com.apple.security.application-groups</key><array><string>${group}</string></array></dict></plist>\n`,
  );
}

function addIosTarget(project, bundleId, version) {
  const targets = project.pbxNativeTargetSection();
  const existing = Object.entries(targets).find(
    ([, target]) => typeof target === 'object' && target.name?.replaceAll('"', '') === TARGET,
  );
  // xcode's extension helper expects these sections even in a project with no prior extension.
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  const main = project.getFirstTarget();
  const target = existing
    ? { uuid: existing[0], pbxNativeTarget: existing[1] }
    : project.addTarget(TARGET, 'app_extension', TARGET, `${bundleId}.widgets`);
  if (!existing) {
    project.addBuildPhase(
      [`${TARGET}/BuboWidgets.swift`, `${TARGET}/BuboTokens.swift`],
      'PBXSourcesBuildPhase',
      'Sources',
      target.uuid,
    );
    project.addBuildPhase(
      [`${TARGET}/Assets.xcassets`, ...FONTS.map(([, file]) => `${TARGET}/${file}`)],
      'PBXResourcesBuildPhase',
      'Resources',
      target.uuid,
    );
    project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
  }
  if (
    !Object.values(objects.PBXGroup).some(
      (group) => typeof group === 'object' && group.name === TARGET,
    )
  ) {
    const group = project.addPbxGroup(
      [
        `${TARGET}/BuboWidgets.swift`,
        `${TARGET}/BuboTokens.swift`,
        `${TARGET}/Assets.xcassets`,
        ...FONTS.map(([, file]) => `${TARGET}/${file}`),
      ],
      TARGET,
      '""',
    );
    const rootGroup = project.getFirstProject().firstProject.mainGroup;
    project.addToPbxGroup({ uuid: group.uuid, pbxGroup: group.pbxGroup }, rootGroup);
  }
  const configs = project.pbxXCBuildConfigurationSection();
  const mainConfigList = objects.XCConfigurationList[main.firstTarget.buildConfigurationList];
  const mainSettings = configs[mainConfigList.buildConfigurations[0].value].buildSettings;
  const extensionList = objects.XCConfigurationList[target.pbxNativeTarget.buildConfigurationList];
  extensionList.buildConfigurations.forEach(({ value }) => {
    Object.assign(configs[value].buildSettings, {
      SWIFT_VERSION: '5.0',
      IPHONEOS_DEPLOYMENT_TARGET: '16.4',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${TARGET}.entitlements"`,
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: mainSettings.CURRENT_PROJECT_VERSION ?? '1',
      MARKETING_VERSION: version,
      APPLICATION_EXTENSION_API_ONLY: 'YES',
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: '""',
      ...(mainSettings.DEVELOPMENT_TEAM ? { DEVELOPMENT_TEAM: mainSettings.DEVELOPMENT_TEAM } : {}),
    });
  });
}

module.exports = function withBuboWidgets(config) {
  const bundleId = config.ios.bundleIdentifier;
  const group = `group.${bundleId}.widgets`;
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.security.application-groups'] = [
      ...new Set([...(mod.modResults['com.apple.security.application-groups'] ?? []), group]),
    ];
    return mod;
  });
  config.extra ??= {};
  config.extra.eas ??= {};
  config.extra.eas.build ??= {};
  config.extra.eas.build.experimental ??= {};
  const extensions = config.extra.eas.build.experimental.ios?.appExtensions ?? [];
  config.extra.eas.build.experimental.ios = {
    appExtensions: [
      ...extensions.filter((extension) => extension.targetName !== TARGET),
      {
        targetName: TARGET,
        bundleIdentifier: `${bundleId}.widgets`,
        entitlements: { 'com.apple.security.application-groups': [group] },
      },
    ],
  };
  config = withDangerousMod(config, [
    'android',
    async (mod) => {
      generateAndroid(mod.modRequest.projectRoot);
      return mod;
    },
  ]);
  config = withDangerousMod(config, [
    'ios',
    async (mod) => {
      generateIos(
        mod.modRequest.projectRoot,
        mod.modRequest.platformProjectRoot,
        bundleId,
        config.version,
      );
      return mod;
    },
  ]);
  return withXcodeProject(config, (mod) => {
    addIosTarget(mod.modResults, bundleId, config.version);
    return mod;
  });
};

// Shared with native-generation tests; no build service or remote mutation involved.
module.exports.generateAndroid = generateAndroid;
module.exports.generateIos = generateIos;
module.exports.addIosTarget = addIosTarget;
module.exports.art = { ICONS };
