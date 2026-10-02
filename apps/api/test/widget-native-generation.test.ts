import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WIDGET_POSES, WIDGET_SCENES } from '@bubo/contracts';
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
    ['400Regular', '700Bold', '800ExtraBold'].forEach((weight) =>
      copy(`assets/fonts/PlusJakartaSans_${weight}.ttf`),
    );
    plugin.generateAndroid(temporary);
    plugin.generateIos(temporary, path.join(temporary, 'ios'), 'com.joaoaraujo.bubo', '0.3.0');
    const android = path.join(temporary, 'modules/bubo-widgets/android/src/main/res');
    const ios = path.join(temporary, 'ios/BuboWidgetsExtension');
    poses.forEach((pose) => {
      const canonical = hash(path.join(mobile, `assets/mascot/bubo-${pose}.png`));
      expect(hash(path.join(android, `drawable-nodpi/bubo_widget_${pose}.png`))).toBe(canonical);
      expect(hash(path.join(ios, `Assets.xcassets/bubo-${pose}.imageset/mascot.png`))).toBe(
        canonical,
      );
    });
    expect(hash(path.join(android, 'font/bubo_bold.ttf'))).toBe(
      hash(path.join(mobile, 'assets/fonts/PlusJakartaSans_700Bold.ttf')),
    );
    const light = readFileSync(path.join(android, 'values/bubo_colors.xml'), 'utf8');
    const dark = readFileSync(path.join(android, 'values-night/bubo_colors.xml'), 'utf8');
    expect(light).not.toBe(dark);
    expect(hash(path.join(android, 'font/bubo_black.ttf'))).toBe(
      hash(path.join(mobile, 'assets/fonts/PlusJakartaSans_800ExtraBold.ttf')),
    );
    const tokens = readFileSync(path.join(ios, 'BuboTokens.swift'), 'utf8');
    expect(tokens).toContain('scheme == .dark');
    // Every scene the domain can pick exists on both platforms, from the theme table.
    const scenes = readFileSync(path.join(android, 'values/bubo_scenes.xml'), 'utf8');
    WIDGET_SCENES.forEach((scene) => {
      expect(tokens).toContain(`case "${scene}"`);
      expect(scenes).toContain(`bubo_scene_${scene}_top`);
      expect(
        readFileSync(path.join(android, `drawable/bubo_scene_${scene}.xml`), 'utf8'),
      ).toContain('gradient');
    });
    expect(tokens.match(/case "/g)).toHaveLength(WIDGET_SCENES.length);
    expect(readFileSync(path.join(ios, 'BuboWidgetsExtension.entitlements'), 'utf8')).toContain(
      'group.com.joaoaraujo.bubo.widgets',
    );
    expect(readFileSync(path.join(android, 'xml/bubo_streak_widget.xml'), 'utf8')).toContain(
      'home_screen',
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
