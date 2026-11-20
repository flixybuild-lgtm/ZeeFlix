const fs = require('fs');
const path = require('path');
const {withDangerousMod} = require('@expo/config-plugins');

module.exports = function withFramewaveNotices(config) {
  return withDangerousMod(config, [
    'android',
    async configWithMod => {
      const projectRoot = configWithMod.modRequest.projectRoot;
      const assetsDirectory = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'assets',
        'licenses',
      );
      fs.mkdirSync(assetsDirectory, {recursive: true});
      for (const [source, destination] of [
        ['LICENSE', 'VEGA-LICENSE.txt'],
        ['NOTICE', 'VEGA-NOTICE.txt'],
      ]) {
        fs.copyFileSync(
          path.join(projectRoot, source),
          path.join(assetsDirectory, destination),
        );
      }
      return configWithMod;
    },
  ]);
};
