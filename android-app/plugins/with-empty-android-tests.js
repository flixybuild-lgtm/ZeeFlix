const {withProjectBuildGradle} = require('expo/config-plugins');

const MARKER = '// Framewave: Expo libraries may publish placeholder test sources.';
const TEST_TASK_POLICY = `\n\n${MARKER}
// Gradle 9 treats source trees with no discoverable tests as a build error.
// Several Expo Android libraries ship placeholder test sources, so skip only
// this empty-discovery failure while still running every test that is found.
subprojects {
  tasks.withType(org.gradle.api.tasks.testing.Test).configureEach {
    failOnNoDiscoveredTests = false
  }
}
`;

module.exports = function withEmptyAndroidTests(config) {
  return withProjectBuildGradle(config, gradleConfig => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('Framewave expects the Android root build.gradle to use Groovy.');
    }

    if (!gradleConfig.modResults.contents.includes(MARKER)) {
      gradleConfig.modResults.contents += TEST_TASK_POLICY;
    }

    return gradleConfig;
  });
};
