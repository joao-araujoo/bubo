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
];
const KINDS = ['streak', 'rhythm', 'calendar', 'reading'];
const RUNS = ['single', 'start', 'middle', 'end'];
/** Scenes whose palettes also style the month calendar (light and pending). */
const CALENDAR_SCENES = ['mint', 'periwinkle', 'slate', 'night', 'lavender'];
const FONTS = [
  ['regular', 'PlusJakartaSans_400Regular.ttf'],
  ['bold', 'PlusJakartaSans_700Bold.ttf'],
  ['black', 'PlusJakartaSans_800ExtraBold.ttf'],
];
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
 * Vector art shared by both platforms. Every shape is a list of absolute commands
 * (M x y, L x y, Q x1 y1 x y, C x1 y1 x2 y2 x y, Z) in a 0–100 tall viewport, so Android gets
 * pathData and iOS gets the same geometry as Swift literals. Decorations only; never the mascot.
 */
/** Colour of the vertical scene gradient at fraction `t`, to paint over decorations. */
function mix(top, bottom, t) {
  const channel = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const value = [0, 1, 2].map((i) =>
    Math.round(channel(top, i) + (channel(bottom, i) - channel(top, i)) * t),
  );
  return `#${value
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
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
function sparkle(x, y, s) {
  return [
    ['M', x, y - s],
    ['Q', x, y, x + s, y],
    ['Q', x, y, x, y + s],
    ['Q', x, y, x - s, y],
    ['Q', x, y, x, y - s],
    ['Z'],
  ];
}
function heart(x, y, s) {
  return [
    ['M', x, y + s * 0.9],
    ['C', x - s * 1.7, y - s * 0.1, x - s * 0.7, y - s * 1.5, x, y - s * 0.45],
    ['C', x + s * 0.7, y - s * 1.5, x + s * 1.7, y - s * 0.1, x, y + s * 0.9],
    ['Z'],
  ];
}
function confetti(x, y, w, h, degrees) {
  const a = (degrees * Math.PI) / 180;
  const corner = (dx, dy) => [
    x + dx * Math.cos(a) - dy * Math.sin(a),
    y + dx * Math.sin(a) + dy * Math.cos(a),
  ];
  const points = [
    corner(-w / 2, -h / 2),
    corner(w / 2, -h / 2),
    corner(w / 2, h / 2),
    corner(-w / 2, h / 2),
  ];
  return [
    ['M', ...points[0]],
    ['L', ...points[1]],
    ['L', ...points[2]],
    ['L', ...points[3]],
    ['Z'],
  ];
}

/** Decoration layouts: [kind, x (0–100 of the width), y, size, alpha, tone?]. */
const DECORATIONS = {
  sparkles: [
    ['sparkle', 84, 14, 6, 0.95],
    ['sparkle', 94, 34, 3, 0.7],
    ['sparkle', 70, 7, 2.5, 0.6],
    ['sparkle', 8, 80, 3.2, 0.45],
    ['dot', 90, 54, 1.4, 0.6],
    ['dot', 62, 22, 1.2, 0.5],
    ['sparkle', 30, 62, 2, 0.3],
  ],
  stars: [
    ['moon', 86, 15, 8.5, 0.95],
    ['sparkle', 70, 8, 2.6, 0.9],
    ['sparkle', 14, 52, 2.2, 0.6],
    ['dot', 60, 20, 1, 0.7],
    ['dot', 95, 34, 1.2, 0.8],
    ['dot', 50, 6, 0.8, 0.6],
    ['dot', 76, 31, 0.9, 0.6],
    ['dot', 7, 72, 1, 0.5],
    ['dot', 22, 90, 0.8, 0.5],
    ['dot', 93, 62, 1, 0.6],
  ],
  confetti: [
    ['confetti', 72, 10, 3, 0.9, 0],
    ['confetti', 90, 22, 3, 0.8, 1],
    ['confetti', 60, 26, 2.4, 0.7, 2],
    ['confetti', 95, 46, 2.6, 0.7, 3],
    ['confetti', 10, 70, 2.6, 0.55, 4],
    ['sparkle', 82, 38, 3, 0.8],
    ['dot', 66, 4, 1.1, 0.7],
    ['dot', 20, 86, 1, 0.5],
  ],
  embers: [
    ['dot', 12, 72, 1.6, 0.8],
    ['dot', 22, 86, 1, 0.6],
    ['dot', 88, 66, 1.8, 0.75],
    ['dot', 94, 82, 1.1, 0.6],
    ['dot', 76, 46, 1, 0.5],
    ['sparkle', 84, 18, 3.4, 0.7],
    ['sparkle', 16, 42, 2, 0.45],
  ],
  hearts: [
    ['heart', 85, 15, 5, 0.9],
    ['heart', 95, 37, 3, 0.6],
    ['heart', 10, 76, 3, 0.45],
    ['sparkle', 70, 8, 2.5, 0.75],
    ['dot', 62, 22, 1.2, 0.5],
  ],
  none: [],
};

/** Shapes for one decoration in a viewport `width` × 100; sizes never stretch. */
function decorationShapes(decoration, width) {
  const shapes = [];
  for (const [kind, px, y, size, alpha, turn = 0] of DECORATIONS[decoration]) {
    const x = (px / 100) * width;
    if (kind === 'sparkle') shapes.push({ tone: 'deco', alpha, ops: sparkle(x, y, size) });
    if (kind === 'dot') shapes.push({ tone: 'deco', alpha, ops: circle(x, y, size) });
    if (kind === 'heart') shapes.push({ tone: 'deco', alpha, ops: heart(x, y, size) });
    if (kind === 'confetti') {
      shapes.push({
        tone: 'deco',
        alpha,
        ops: confetti(x, y, size * 1.6, size * 0.8, 25 + turn * 47),
      });
    }
    if (kind === 'moon') {
      shapes.push({ tone: 'deco', alpha, ops: circle(x, y, size) });
      // A "bite" in the sky colour turns the disc into a crescent.
      shapes.push({
        tone: 'sky',
        sky: y / 100,
        alpha: 1,
        ops: circle(x + size * 0.45, y - size * 0.3, size * 0.82),
      });
    }
  }
  return shapes;
}

/** Streak flame (24 × 24): outer body and inner glow. */
const FLAME = {
  outer: [
    ['M', 12, 1.6],
    ['C', 12, 1.6, 19.6, 7.2, 19.6, 14.2],
    ['C', 19.6, 18.8, 16.2, 22.4, 12, 22.4],
    ['C', 7.8, 22.4, 4.4, 18.8, 4.4, 14.2],
    ['C', 4.4, 11, 6.1, 8.7, 7.7, 7.5],
    ['C', 7.8, 9.9, 8.9, 11.4, 10.2, 11.8],
    ['C', 9.6, 7.6, 12, 1.6, 12, 1.6],
    ['Z'],
  ],
  inner: [
    ['M', 12, 11.6],
    ['C', 12, 11.6, 15.9, 14.4, 15.9, 17.4],
    ['C', 15.9, 19.6, 14.1, 21.2, 12, 21.2],
    ['C', 9.9, 21.2, 8.1, 19.6, 8.1, 17.4],
    ['C', 8.1, 15.4, 9.6, 14.2, 10.4, 13.8],
    ['C', 10.6, 14.9, 11.2, 15.6, 11.9, 15.8],
    ['C', 11.5, 14.2, 12, 11.6, 12, 11.6],
    ['Z'],
  ],
};
/** White "!" of the at-risk badge (24 × 24). */
const ALERT_MARK = [
  ['M', 10.6, 5.6],
  ['L', 13.4, 5.6],
  ['L', 12.9, 13.6],
  ['L', 11.1, 13.6],
  ['Z'],
  ...circle(12, 17.2, 1.6),
];
const CHECK = [
  ['M', 7.2, 12.4],
  ['L', 10.4, 15.6],
  ['L', 16.8, 9.2],
];

const pathData = (ops) =>
  ops.map(([command, ...values]) => command + values.map(round).join(',')).join(' ');
const vector = (width, height, paths) =>
  `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${width}dp" android:height="${height}dp" android:viewportWidth="${width}" android:viewportHeight="${height}">\n${paths.join('\n')}\n</vector>\n`;
const fill = (color, ops, alpha = 1) =>
  `  <path android:fillColor="${color}" android:fillAlpha="${alpha}" android:pathData="${pathData(ops)}"/>`;
const shape = (body) =>
  `<shape xmlns:android="http://schemas.android.com/apk/res/android" ${body}</shape>\n`;

function generateAndroid(root) {
  const res = path.join(root, 'modules/bubo-widgets/android/src/main/res');
  const { lightColors, darkColors, widgetScenes, widgetFlame, palette } = readTheme(root);
  const keys = ['surface', 'text', 'textMuted', 'primary', 'primarySoft', 'onPrimary', 'border'];
  for (const [folder, colors] of [
    ['values', lightColors],
    ['values-night', darkColors],
  ]) {
    write(
      path.join(res, folder, 'bubo_colors.xml'),
      `<resources>\n${keys.map((key) => `  <color name="bubo_${key}">${colors[key]}</color>`).join('\n')}\n</resources>\n`,
    );
  }
  // Scenes look the same in light and dark mode, like the reference widgets.
  const sceneColors = Object.entries(widgetScenes).flatMap(([scene, colors]) =>
    ['top', 'bottom', 'text', 'muted', 'number', 'pill', 'pillText', 'deco'].map(
      (key) => `  <color name="bubo_scene_${scene}_${key}">${colors[key]}</color>`,
    ),
  );
  write(
    path.join(res, 'values/bubo_scenes.xml'),
    `<resources>\n  <color name="bubo_flame">${widgetFlame.outer}</color>\n  <color name="bubo_flame_glow">${widgetFlame.inner}</color>\n  <color name="bubo_alert">${widgetFlame.alert}</color>\n  <color name="bubo_card">${palette.white}</color>\n  <color name="bubo_card_text">${palette.ink}</color>\n  <color name="bubo_card_muted">${palette.inkMuted}</color>\n  <color name="bubo_card_track">${palette.purpleSoft}</color>\n  <color name="bubo_card_fill">${palette.purple}</color>\n${sceneColors.join('\n')}\n</resources>\n`,
  );
  for (const pose of POSES)
    copy(
      path.join(root, `assets/mascot/bubo-${pose}.png`),
      path.join(res, `drawable-nodpi/bubo_widget_${pose}.png`),
    );
  for (const [name, file] of FONTS) {
    copy(path.join(root, 'assets/fonts', file), path.join(res, `font/bubo_${name}.ttf`));
  }
  const drawable = (name, text) => write(path.join(res, `drawable/${name}.xml`), text);
  for (const [scene, colors] of Object.entries(widgetScenes)) {
    drawable(
      `bubo_scene_${scene}`,
      shape(
        `android:shape="rectangle"><gradient android:angle="270" android:startColor="${colors.top}" android:endColor="${colors.bottom}"/><corners android:radius="24dp"/>`,
      ),
    );
    for (const [suffix, width] of [
      ['', 100],
      ['_wide', 220],
    ]) {
      const paths = decorationShapes(colors.decoration, width).map((item) =>
        fill(
          item.tone === 'sky' ? mix(colors.top, colors.bottom, item.sky) : colors.deco,
          item.ops,
          item.alpha,
        ),
      );
      drawable(
        `bubo_deco_${scene}${suffix}`,
        vector(width, 100, paths.length ? paths : [fill(colors.deco, circle(0, 0, 0.01), 0)]),
      );
    }
    // Week circles: pending/missed days and today's ring.
    drawable(
      `bubo_week_${scene}`,
      shape(`android:shape="oval"><solid android:color="${colors.pill}"/>`),
    );
    drawable(
      `bubo_week_today_${scene}`,
      shape(
        `android:shape="oval"><solid android:color="${colors.pill}"/><stroke android:width="2dp" android:color="${colors.text}"/>`,
      ),
    );
  }
  for (const scene of CALENDAR_SCENES) {
    const colors = widgetScenes[scene];
    const corners = {
      single: 'android:radius="9dp"',
      start: 'android:topLeftRadius="9dp" android:bottomLeftRadius="9dp"',
      middle: 'android:radius="0dp"',
      end: 'android:topRightRadius="9dp" android:bottomRightRadius="9dp"',
    };
    // Runs fill the cell edge to edge (1dp row gap) so consecutive days read as one pill;
    // today is a centred disc on top of its run, or a ring when there is no activity yet.
    const pill = (run) =>
      `  <item android:top="1dp" android:bottom="1dp"><shape android:shape="rectangle"><solid android:color="${colors.pill}"/><corners ${corners[run]}/></shape></item>\n`;
    const disc = `  <item android:gravity="center" android:width="17dp" android:height="17dp"><shape android:shape="oval"><solid android:color="${colors.number}"/></shape></item>\n`;
    const layers = (body) =>
      `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n${body}</layer-list>\n`;
    for (const run of RUNS) {
      drawable(`bubo_cal_${scene}_${run}`, layers(pill(run)));
      drawable(`bubo_cal_${scene}_${run}_today`, layers(pill(run) + disc));
    }
    drawable(
      `bubo_cal_${scene}_ring`,
      layers(
        `  <item android:gravity="center" android:width="17dp" android:height="17dp"><shape android:shape="oval"><stroke android:width="1.5dp" android:color="${colors.number}"/></shape></item>\n`,
      ),
    );
  }
  drawable(
    'bubo_flame',
    vector(24, 24, [fill(widgetFlame.outer, FLAME.outer), fill(widgetFlame.inner, FLAME.inner)]),
  );
  // Unlit flame: hollow, in the scene's number colour (no activity today yet).
  for (const [scene, colors] of Object.entries(widgetScenes)) {
    drawable(
      `bubo_flame_off_${scene}`,
      vector(24, 24, [
        `  <path android:fillColor="${colors.number}" android:fillAlpha="0.92" android:fillType="evenOdd" android:pathData="${pathData([...FLAME.outer, ...FLAME.inner])}"/>`,
      ]),
    );
  }
  drawable(
    'bubo_flame_alert',
    vector(24, 24, [fill(widgetFlame.alert, circle(12, 12, 11)), fill(palette.white, ALERT_MARK)]),
  );
  drawable(
    'bubo_check',
    `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">\n  <path android:strokeColor="${palette.white}" android:strokeWidth="2.8" android:strokeLineCap="round" android:strokeLineJoin="round" android:pathData="${pathData(CHECK)}"/>\n</vector>\n`,
  );
  drawable(
    'bubo_week_done',
    `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item><shape android:shape="oval"><solid android:color="${widgetFlame.outer}"/></shape></item>\n  <item android:drawable="@drawable/bubo_check"/>\n</layer-list>\n`,
  );
  drawable(
    'bubo_card',
    shape(
      `android:shape="rectangle"><solid android:color="${palette.white}"/><corners android:radius="16dp"/>`,
    ),
  );
  drawable(
    'bubo_progress',
    `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item android:id="@android:id/background"><shape><solid android:color="${palette.purpleSoft}"/><corners android:radius="4dp"/></shape></item>\n  <item android:id="@android:id/progress"><clip><shape><solid android:color="${palette.purple}"/><corners android:radius="4dp"/></shape></clip></item>\n</layer-list>\n`,
  );
  const sizes = {
    streak: { width: 110, height: 110, cellsW: 2, cellsH: 2, resize: 'horizontal|vertical' },
    rhythm: { width: 250, height: 110, cellsW: 4, cellsH: 2, resize: 'horizontal|vertical' },
    calendar: { width: 250, height: 140, cellsW: 4, cellsH: 2, resize: 'horizontal|vertical' },
    reading: { width: 250, height: 110, cellsW: 4, cellsH: 2, resize: 'horizontal|vertical' },
  };
  for (const kind of KINDS) {
    const size = sizes[kind];
    write(
      path.join(res, `xml/bubo_${kind}_widget.xml`),
      `<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="${size.width}dp" android:minHeight="${size.height}dp"
  android:minResizeWidth="110dp" android:minResizeHeight="110dp"
  android:targetCellWidth="${size.cellsW}" android:targetCellHeight="${size.cellsH}"
  android:updatePeriodMillis="1800000" android:initialLayout="@layout/bubo_widget_${kind}"
  android:previewLayout="@layout/bubo_widget_${kind}" android:resizeMode="${size.resize}"
  android:widgetCategory="home_screen" />\n`,
    );
  }
}

/** Swift literal for shapes: opcodes 0 M, 1 L, 2 Q, 3 C, 4 Z followed by their coordinates. */
function swiftOps(ops) {
  const codes = { M: 0, L: 1, Q: 2, C: 3, Z: 4 };
  return `[${ops.flatMap(([command, ...values]) => [codes[command], ...values.map(round)]).join(', ')}]`;
}

function generateIos(root, platformRoot, bundleId, version) {
  const directory = path.join(platformRoot, TARGET);
  const group = `group.${bundleId}.widgets`;
  const { lightColors, darkColors, widgetScenes, widgetFlame, palette } = readTheme(root);
  const keys = [
    'surface',
    'text',
    'textMuted',
    'primary',
    'primarySoft',
    'onPrimary',
    'accentText',
  ];
  const scenes = Object.entries(widgetScenes).map(([scene, colors]) => {
    const art = (width) =>
      `[${decorationShapes(colors.decoration, width)
        .map((item) => {
          const cover =
            item.tone === 'sky'
              ? `Color(hex: "${mix(colors.top, colors.bottom, item.sky)}")`
              : 'nil';
          return `BuboShape(cover: ${cover}, alpha: ${item.alpha}, ops: ${swiftOps(item.ops)})`;
        })
        .join(', ')}]`;
    return `    case "${scene}": return BuboScene(top: Color(hex: "${colors.top}"), bottom: Color(hex: "${colors.bottom}"), text: Color(hex: "${colors.text}"), muted: Color(hex: "${colors.muted}"), number: Color(hex: "${colors.number}"), pill: Color(hex: "${colors.pill}"), pillText: Color(hex: "${colors.pillText}"), deco: Color(hex: "${colors.deco}"), square: ${art(100)}, wide: ${art(220)})`;
  });
  const swift = `import SwiftUI
// Generated by plugins/with-bubo-widgets.config.cjs from src/theme/colors.ts. Do not edit.
enum BuboTokens {
${keys.map((key) => `  static func ${key}(_ scheme: ColorScheme) -> Color { Color(hex: scheme == .dark ? "${darkColors[key]}" : "${lightColors[key]}") }`).join('\n')}
  static let flame = Color(hex: "${widgetFlame.outer}")
  static let flameGlow = Color(hex: "${widgetFlame.inner}")
  static let alert = Color(hex: "${widgetFlame.alert}")
  static let card = Color(hex: "${palette.white}")
  static let cardText = Color(hex: "${palette.ink}")
  static let cardMuted = Color(hex: "${palette.inkMuted}")
  static let cardTrack = Color(hex: "${palette.purpleSoft}")
  static let cardFill = Color(hex: "${palette.purple}")
  static let white = Color(hex: "${palette.white}")
  static let flameOuter: [Double] = ${swiftOps(FLAME.outer)}
  static let flameInner: [Double] = ${swiftOps(FLAME.inner)}
  static let alertMark: [Double] = ${swiftOps(ALERT_MARK)}
  static let check: [Double] = ${swiftOps(CHECK)}
}
struct BuboShape { let cover: Color?; let alpha: Double; let ops: [Double] }
struct BuboScene {
  let top: Color; let bottom: Color; let text: Color; let muted: Color; let number: Color
  let pill: Color; let pillText: Color; let deco: Color
  let square: [BuboShape]; let wide: [BuboShape]
  static func named(_ id: String) -> BuboScene {
    switch id {
${scenes.join('\n')}
    default: return named("lavender")
    }
  }
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
module.exports.art = { decorationShapes, FLAME, CHECK, ALERT_MARK, mix };
