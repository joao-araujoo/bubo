import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WIDGET_KINDS, WIDGET_POSES } from '@bubo/contracts';
import { afterAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const plugin = require('../../mobile/plugins/with-bubo-widgets.config.cjs') as {
  generateAndroid: (root: string) => void;
  generateIos: (root: string, platformRoot: string, bundleId: string, version: string) => void;
  addIosTarget: (project: unknown, bundleId: string, version: string) => void;
};
type Project = {
  hash: {
    project: {
      archiveVersion: string;
      classes: object;
      objectVersion: string;
      objects: Record<string, object>;
      rootObject: string;
    };
  };
  writeSync: () => string;
  parseSync: () => Project;
  pbxNativeTargetSection: () => Record<string, { name: string; buildPhases: { value: string }[] }>;
};
const xcode = require('xcode') as { project: (file: string) => Project };
const temporary = mkdtempSync(path.join(tmpdir(), 'bubo-widgets-'));
const mobile = path.resolve(import.meta.dirname, '../../mobile');

afterAll(() => rmSync(temporary, { recursive: true, force: true }));
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
function copy(relative: string) {
  const target = path.join(temporary, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(mobile, relative), target);
}

describe('native widget generation', () => {
  it('copies canonical poses/fonts byte for byte and uses theme tokens on both platforms', () => {
    copy('src/theme/colors.ts');
    copy('native-widgets/BuboWidgets.swift');
    const poses = WIDGET_POSES.map((pose) => pose);
    poses.forEach((pose) => copy(`assets/mascot/bubo-${pose}.png`));
    const fonts = ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'];
    fonts.forEach((weight) => copy(`assets/fonts/PlusJakartaSans_${weight}.ttf`));
    plugin.generateAndroid(temporary);
    plugin.generateIos(temporary, path.join(temporary, 'ios'), 'com.joaoaraujo.bubo', '0.3.0');
    const main = path.join(temporary, 'modules/bubo-widgets/android/src/main');
    const android = path.join(main, 'res');
    const ios = path.join(temporary, 'ios/BuboWidgetsExtension');
    poses.forEach((pose) => {
      const canonical = hash(path.join(mobile, `assets/mascot/bubo-${pose}.png`));
      const resource = `bubo_widget_${pose.replaceAll('-', '_')}`;
      expect(hash(path.join(android, `drawable-nodpi/${resource}.png`))).toBe(canonical);
      expect(hash(path.join(ios, `Assets.xcassets/bubo-${pose}.imageset/mascot.png`))).toBe(
        canonical,
      );
    });
    // RemoteViews ignore @font, so Android loads the official files from assets (ADR-029).
    fonts.forEach((weight) => {
      const file = `PlusJakartaSans_${weight}.ttf`;
      const canonical = hash(path.join(mobile, 'assets/fonts', file));
      expect(hash(path.join(main, `assets/bubo-widgets/${file}`))).toBe(canonical);
      expect(hash(path.join(ios, file))).toBe(canonical);
    });
    const kotlin = readFileSync(
      path.join(main, 'java/expo/modules/bubowidgets/BuboTokens.kt'),
      'utf8',
    );
    const tokens = readFileSync(path.join(ios, 'BuboTokens.swift'), 'utf8');
    // One palette: both platforms get the same widget colours and icon geometry from the theme.
    const theme = readFileSync(path.join(mobile, 'src/theme/colors.ts'), 'utf8');
    expect(theme).toContain("flame: '#FF9416'");
    expect(kotlin).toContain('val flame = 0xFFFF9416.toInt()');
    expect(tokens).toContain('static let flame = Color(hex: "#FF9416")');
    for (const icon of ['flameOuter', 'snowflake', 'check', 'trophy', 'badge', 'gemCut', 'clock']) {
      expect(kotlin).toContain(`val ${icon} = floatArrayOf(`);
      expect(tokens).toContain(`static let ${icon}: [Double] = [`);
    }
    expect(kotlin).toContain('PlusJakartaSans_800ExtraBold.ttf');
    expect(readFileSync(path.join(ios, 'BuboWidgetsExtension-Info.plist'), 'utf8')).toContain(
      '<string>PlusJakartaSans_600SemiBold.ttf</string>',
    );
    expect(readFileSync(path.join(ios, 'BuboWidgetsExtension.entitlements'), 'utf8')).toContain(
      'group.com.joaoaraujo.bubo.widgets',
    );
    WIDGET_KINDS.forEach((kind) => {
      const info = readFileSync(path.join(android, `xml/bubo_${kind}_widget.xml`), 'utf8');
      expect(info).toContain('home_screen');
      expect(info).toContain('@layout/bubo_widget_canvas');
      expect(info).toContain(`@layout/bubo_preview_${kind}`);
    });
    // Static layouts never use classes RemoteViews refuse (the old week widget used <View>).
    const layouts = path.join(mobile, 'modules/bubo-widgets/android/src/main/res/layout');
    for (const file of [
      'bubo_widget_canvas.xml',
      ...WIDGET_KINDS.map((kind) => `bubo_preview_${kind}.xml`),
    ]) {
      const xml = readFileSync(path.join(layouts, file), 'utf8');
      const tags = [...xml.matchAll(/<([A-Za-z.]+)[\s>]/g)].map((match) => match[1]);
      expect(
        tags.filter((tag) => !['FrameLayout', 'LinearLayout', 'ImageView'].includes(tag ?? '')),
      ).toEqual([]);
    }
    const manifest = readFileSync(
      path.join(mobile, 'modules/bubo-widgets/android/src/main/AndroidManifest.xml'),
      'utf8',
    );
    ['Streak', 'Rhythm', 'Calendar', 'Reading', 'League'].forEach((name) =>
      expect(manifest).toContain(`.${name}Widget`),
    );
    expect(readFileSync(path.join(mobile, 'native-widgets/BuboWidgets.swift'), 'utf8')).toContain(
      'BuboLeagueWidget()',
    );
    // Regeneration must not introduce new IDs, different assets or another palette.
    const before = hash(path.join(ios, 'BuboWidgetsExtension-Info.plist'));
    plugin.generateIos(temporary, path.join(temporary, 'ios'), 'com.joaoaraujo.bubo', '0.3.0');
    expect(hash(path.join(ios, 'BuboWidgetsExtension-Info.plist'))).toBe(before);
  });

  it('embeds one extension with source/resource membership and keeps the host signing version', () => {
    const project = xcode.project('host.pbxproj');
    project.hash = {
      project: {
        archiveVersion: '1',
        classes: {},
        objectVersion: '54',
        rootObject: 'PROJECT',
        objects: {
          PBXBuildFile: {},
          PBXFileReference: {},
          PBXSourcesBuildPhase: {},
          PBXResourcesBuildPhase: {},
          PBXFrameworksBuildPhase: {},
          PBXGroup: {
            ROOT: {
              isa: 'PBXGroup',
              children: [{ value: 'PRODUCTS', comment: 'Products' }],
              sourceTree: '"<group>"',
            },
            PRODUCTS: { isa: 'PBXGroup', name: 'Products', children: [], sourceTree: '"<group>"' },
            PRODUCTS_comment: 'Products',
          },
          PBXProject: {
            PROJECT: {
              isa: 'PBXProject',
              mainGroup: 'ROOT',
              productRefGroup: 'PRODUCTS',
              targets: [{ value: 'APP', comment: 'Bubo' }],
            },
          },
          PBXNativeTarget: {
            APP: {
              isa: 'PBXNativeTarget',
              name: '"Bubo"',
              buildConfigurationList: 'APP_CONFIG',
              buildPhases: [],
              dependencies: [],
            },
          },
          XCConfigurationList: {
            APP_CONFIG: {
              isa: 'XCConfigurationList',
              buildConfigurations: [{ value: 'DEBUG' }, { value: 'RELEASE' }],
              defaultConfigurationName: 'Release',
            },
          },
          XCBuildConfiguration: {
            DEBUG: {
              isa: 'XCBuildConfiguration',
              name: 'Debug',
              buildSettings: { CURRENT_PROJECT_VERSION: '42', DEVELOPMENT_TEAM: 'TESTTEAM' },
            },
            RELEASE: {
              isa: 'XCBuildConfiguration',
              name: 'Release',
              buildSettings: { CURRENT_PROJECT_VERSION: '42', DEVELOPMENT_TEAM: 'TESTTEAM' },
            },
          },
        },
      },
    };
    plugin.addIosTarget(project, 'com.joaoaraujo.bubo', '0.3.0');
    const before = project.writeSync();
    plugin.addIosTarget(project, 'com.joaoaraujo.bubo', '0.3.0');
    expect(project.writeSync()).toBe(before);
    const targets = Object.values(project.pbxNativeTargetSection()).filter(
      (value) => typeof value === 'object' && value.name === '"BuboWidgetsExtension"',
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]?.buildPhases).toHaveLength(3);
    expect(before).toContain('BuboWidgetsExtension/BuboWidgets.swift');
    expect(before).toContain('BuboWidgetsExtension/Assets.xcassets');
    expect(before).toContain('CURRENT_PROJECT_VERSION = 42');
    expect(before).toContain('DEVELOPMENT_TEAM = TESTTEAM');
    expect(before).toContain('PBXTargetDependency');
    const file = path.join(temporary, 'host.pbxproj');
    writeFileSync(file, before);
    const parsed = xcode.project(file).parseSync();
    expect(
      Object.values(parsed.pbxNativeTargetSection()).filter((value) => typeof value === 'object'),
    ).toHaveLength(2);
  });
});
