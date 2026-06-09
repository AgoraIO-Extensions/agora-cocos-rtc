const sdkConfig = require('./sdk-config.js');

function renderPodfile(options = {}) {
  const targetName = options.targetName || 'agora-cocos-basic-call-mobile';
  const projectName = options.projectName || 'agora-cocos-basic-call.xcodeproj';
  const ios = sdkConfig.ios;

  if (ios.integrationMode !== 'cocoapods') {
    throw new Error(`iOS integrationMode is ${ios.integrationMode}; use Swift Package Manager integration instead.`);
  }

  return `platform :ios, '${ios.deploymentTarget}'

project '${projectName}'

target '${targetName}' do
  use_frameworks! :linkage => :static

  pod '${ios.podName}', '${ios.packageVersion}'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_VERSION'] = '${ios.swiftVersion}'
    end
  end
end
`;
}

module.exports = {
  renderPodfile,
};
