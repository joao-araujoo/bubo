const { withInfoPlist } = require('expo/config-plugins');

function configureInfoPlist(plist) {
  plist.LSApplicationQueriesSchemes = [
    ...new Set([...(plist.LSApplicationQueriesSchemes ?? []), 'instagram-stories']),
  ];
  plist.NSPhotoLibraryAddUsageDescription =
    'O Bubo pede permissão apenas para salvar na sua galeria o Story que você escolheu.';
  return plist;
}

module.exports = function withBuboStories(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults = configureInfoPlist(mod.modResults);
    return mod;
  });
};

module.exports.configureInfoPlist = configureInfoPlist;
