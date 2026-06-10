const path = require('node:path');
const {
  access,
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile,
} = require('node:fs/promises');
const sdkConfig = require('./sdk-config.js');

const IOS_GUIDE_RELATIVE_PATH = 'AGORA_RTC_SPM_SETUP.md';
const IOS_APP_DELEGATE_FORWARD_DECLARATION = `@interface AgoraRtcPlugin : NSObject
+ (instancetype)sharedInstance;
- (void)attachBridge;
@end`;
const IOS_APP_DELEGATE_ATTACH_CALL = '    [[AgoraRtcPlugin sharedInstance] attachBridge];';
const ANDROID_APP_ACTIVITY_IMPORT = 'import io.agora.cocos.rtc.AgoraRtcPlugin;';
const ANDROID_APP_ACTIVITY_ATTACH_CALL = '        AgoraRtcPlugin.getInstance().attachBridge();';
const ANDROID_APP_ACTIVITY_PERMISSION_FORWARDER = `    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        AgoraRtcPlugin.getInstance().onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
`;
const ANDROID_APP_ACTIVITY_PERMISSION_FORWARD_CALL = '        AgoraRtcPlugin.getInstance().onRequestPermissionsResult(requestCode, permissions, grantResults);';
const ANDROID_RTC_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.MODIFY_AUDIO_SETTINGS',
];
const IOS_RTC_USAGE_DESCRIPTIONS = {
  NSCameraUsageDescription: 'Agora RTC needs camera access for local video preview and calls.',
  NSMicrophoneUsageDescription: 'Agora RTC needs microphone access for voice calls.',
};
const COMMON_ENGINE_TEXTURE_BRIDGE_FILES = [
  'AgoraEngineTextureBridge.h',
  'AgoraEngineTextureBridge.cpp',
];
const COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK = `list(APPEND CC_COMMON_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.h
    \${CMAKE_CURRENT_LIST_DIR}/Classes/agora/AgoraEngineTextureBridge.cpp
)`;
const IOS_RTC_BRIDGE_CMAKE_BLOCK = `list(APPEND CC_PROJ_SOURCES
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcPlugin.mm
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraEngineTextureSlotBridge.mm
)

set_source_files_properties(
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcPlugin.mm
    \${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraEngineTextureSlotBridge.mm
    PROPERTIES
    GENERATED FALSE
)

set(CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "${sdkConfig.ios.swiftVersion}")`;
const IOS_SPM_PACKAGE_REF_ID = 'A90A00000000000000000101';
const IOS_SPM_PRODUCT_ID = 'A90A00000000000000000102';
const IOS_SPM_BUILD_FILE_ID = 'A90A00000000000000000103';
const IOS_NATIVE_SOURCES_BUILD_PHASE_ID = 'A90A00000000000000000200';
const IOS_NATIVE_SOURCE_FILES = [
  {
    name: 'AgoraRtcBridge.swift',
    path: 'agora-rtc/AgoraRtcBridge.swift',
    fileRefId: 'A90A00000000000000000201',
    buildFileId: 'A90A00000000000000000202',
    explicitFileType: 'sourcecode.swift',
  },
  {
    name: 'AgoraRtcPlugin.mm',
    path: 'agora-rtc/AgoraRtcPlugin.mm',
    fileRefId: 'A90A00000000000000000203',
    buildFileId: 'A90A00000000000000000204',
    explicitFileType: 'sourcecode.cpp.objcpp',
  },
  {
    name: 'AgoraEngineTextureSlotBridge.mm',
    path: 'agora-rtc/AgoraEngineTextureSlotBridge.mm',
    fileRefId: 'A90A00000000000000000205',
    buildFileId: 'A90A00000000000000000206',
    explicitFileType: 'sourcecode.cpp.objcpp',
  },
  {
    name: 'AgoraEngineTextureBridge.cpp',
    path: '../../../native/engine/common/Classes/agora/AgoraEngineTextureBridge.cpp',
    fileRefId: 'A90A00000000000000000207',
    buildFileId: 'A90A00000000000000000208',
    explicitFileType: 'sourcecode.cpp.cpp',
  },
];
const IOS_WORKSPACE_SETTINGS_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>BuildSystemType</key>
\t<string>Latest</string>
\t<key>BuildLocationStyle</key>
\t<string>Unique</string>
\t<key>IDEWorkspaceSharedSettings_AutocreateContextsIfNeeded</key>
\t<false/>
</dict>
</plist>
`;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getIosSwiftPackageName() {
  return path.basename(sdkConfig.ios.packageUrl).replace(/\.git$/, '');
}

function findPbxSection(content, sectionName) {
  const beginMarker = `/* Begin ${sectionName} section */`;
  const endMarker = `/* End ${sectionName} section */`;
  const beginIndex = content.indexOf(beginMarker);
  const endIndex = content.indexOf(endMarker);

  if (beginIndex < 0 || endIndex < beginIndex) {
    return null;
  }

  return {
    beginIndex,
    endIndex,
    beginMarker,
    endMarker,
    body: content.slice(beginIndex + beginMarker.length, endIndex),
  };
}

function listPbxObjects(content, sectionName) {
  const section = findPbxSection(content, sectionName);
  if (!section) {
    return [];
  }

  const objects = [];
  const objectPattern = /^([ \t]*)([A-Za-z0-9]{24}) \/\* ([^*]+) \*\/ = \{[\s\S]*?^\1\};/gm;
  let match;
  while ((match = objectPattern.exec(section.body)) !== null) {
    objects.push({
      id: match[2],
      comment: match[3],
      text: match[0],
    });
  }
  return objects;
}

function findPbxObject(content, sectionName, predicate) {
  return listPbxObjects(content, sectionName).find(predicate) || null;
}

function ensurePbxSectionEntry(content, sectionName, entry, entryId) {
  if (content.includes(`${entryId} /*`)) {
    return content;
  }

  const section = findPbxSection(content, sectionName);
  if (section) {
    return `${content.slice(0, section.endIndex)}${entry}\n${content.slice(section.endIndex)}`;
  }

  const newSection = `\n/* Begin ${sectionName} section */\n${entry}\n/* End ${sectionName} section */\n`;
  const anchor = '/* Begin XCBuildConfiguration section */';
  if (content.includes(anchor)) {
    return content.replace(anchor, `${newSection}\n${anchor}`);
  }

  const objectsEnd = '\n\t};\n\trootObject';
  if (content.includes(objectsEnd)) {
    return content.replace(objectsEnd, `${newSection}${objectsEnd}`);
  }

  return content;
}

function replacePbxObject(content, object, replacement) {
  return content.replace(object.text, replacement);
}

function ensurePbxListItem(objectText, listName, itemLine) {
  const itemId = itemLine.trim().split(/\s+/)[0];
  if (objectText.includes(`${itemId} /*`)) {
    return objectText;
  }

  const objectIndent = objectText.match(/^([ \t]*)/)?.[1] || '';
  const propertyIndent = objectText.match(/\n([ \t]+)isa = /)?.[1] || `${objectIndent}\t`;

  const listPattern = new RegExp(`(^[ \\t]*)${escapeRegExp(listName)} = \\(\\n([\\s\\S]*?^\\1\\);)`, 'm');
  if (listPattern.test(objectText)) {
    return objectText.replace(listPattern, (match, indent, rest) => {
      return `${indent}${listName} = (\n${indent}\t${itemLine}\n${rest}`;
    });
  }

  const insertionPattern = /(^[ \t]*)productName = /m;
  if (insertionPattern.test(objectText)) {
    return objectText.replace(insertionPattern, (match, indent) => {
      return `${indent}${listName} = (\n${indent}\t${itemLine}\n${indent});\n${match}`;
    });
  }

  const objectEnd = `\n${objectIndent}};`;
  const objectEndIndex = objectText.lastIndexOf(objectEnd);
  if (objectEndIndex < 0) {
    return objectText;
  }

  return `${objectText.slice(0, objectEndIndex)}\n${propertyIndent}${listName} = (\n${propertyIndent}\t${itemLine}\n${propertyIndent});${objectText.slice(objectEndIndex)}`;
}

function patchIosSwiftPackageRequirement(packageRefObject) {
  const requirementBlock = `requirement = {
\t\t\t\tkind = exactVersion;
\t\t\t\tversion = ${sdkConfig.ios.packageVersion};
\t\t\t};`;

  if (/requirement = \{[\s\S]*?\n\t\t\t\};/.test(packageRefObject.text)) {
    return packageRefObject.text.replace(/requirement = \{[\s\S]*?\n\t\t\t\};/, requirementBlock);
  }

  return packageRefObject.text.replace(
    /^([ \t]*)repositoryURL = .*;$/m,
    (match, indent) => `${match}\n${indent}${requirementBlock}`,
  );
}

function quotePbxBuildSettingValue(value) {
  const trimmed = String(value).trim().replace(/^"|"$/g, '');
  return `"${trimmed}"`;
}

function formatPbxBuildSettingArray(indent, values) {
  const uniqueValues = [];
  for (const value of values) {
    const normalized = String(value).trim().replace(/^"|"$/g, '');
    if (normalized && !uniqueValues.includes(normalized)) {
      uniqueValues.push(normalized);
    }
  }

  const valueLines = uniqueValues
    .map((value) => `${indent}  ${quotePbxBuildSettingValue(value)},`)
    .join('\n');
  return `${indent}LD_RUNPATH_SEARCH_PATHS = (\n${valueLines}\n${indent});`;
}

function ensureIosFrameworksRunpath(buildSettingsBody) {
  const arrayPattern = /^([ \t]*)LD_RUNPATH_SEARCH_PATHS = \(\n([\s\S]*?)^\1\);/m;
  if (arrayPattern.test(buildSettingsBody)) {
    return buildSettingsBody.replace(arrayPattern, (match, indent, valuesBody) => {
      if (valuesBody.includes('@executable_path/Frameworks')) {
        return match;
      }

      const existingValues = [...valuesBody.matchAll(/^\s*"?([^",\n]+)"?,?\s*$/gm)]
        .map((valueMatch) => valueMatch[1])
        .filter(Boolean);
      const values = existingValues.length > 0 ? existingValues : ['$(inherited)'];
      return formatPbxBuildSettingArray(indent, [...values, '@executable_path/Frameworks']);
    });
  }

  const scalarPattern = /^([ \t]*)LD_RUNPATH_SEARCH_PATHS = ([^;]*);$/m;
  if (scalarPattern.test(buildSettingsBody)) {
    return buildSettingsBody.replace(scalarPattern, (_match, indent, value) => {
      const normalizedValue = String(value).trim().replace(/^"|"$/g, '');
      const values = normalizedValue ? normalizedValue.split(/\s+/) : ['$(inherited)'];
      return formatPbxBuildSettingArray(indent, [...values, '@executable_path/Frameworks']);
    });
  }

  const settingIndent = buildSettingsBody.match(/^([ \t]+)[A-Za-z0-9_]+(?:\[[^\]]+\])? = /m)?.[1] || '\t\t\t';
  const prefix = buildSettingsBody.endsWith('\n') || buildSettingsBody.length === 0 ? '' : '\n';
  return `${buildSettingsBody}${prefix}${formatPbxBuildSettingArray(settingIndent, [
    '$(inherited)',
    '@executable_path/Frameworks',
  ])}\n`;
}

function patchIosXcodeProjectBuildSettingsObject(objectText) {
  return objectText.replace(
    /(^[ \t]*buildSettings = \{\n)([\s\S]*?)(^[ \t]*\};)/m,
    (match, start, body, end) => {
      let patchedBody = body
        .replace(
          /^[ \t]*(?:SYMROOT|OBJROOT|CONFIGURATION_BUILD_DIR|CONFIGURATION_TEMP_DIR)(?:\[[^\]]+\])? = .*;\n?/gm,
          '',
        )
        .replace(
          /"[^"\n]*\/boost\/container\/archives\/[^/"\n]+\/libboost_container\.a"/g,
          '"$(CONFIGURATION_BUILD_DIR)/libboost_container.a"',
        )
        .replace(
          /"[^"\n]*\/archives\/[^/"\n]+\/libcocos_engine\.a"/g,
          '"$(CONFIGURATION_BUILD_DIR)/libcocos_engine.a"',
        );

      patchedBody = ensureIosFrameworksRunpath(patchedBody);
      return `${start}${patchedBody}${end}`;
    },
  );
}

function patchIosXcodeProjectBuildSettingsForSwiftPackage(content) {
  let next = content;
  for (const buildConfiguration of listPbxObjects(content, 'XCBuildConfiguration')) {
    const patchedObject = patchIosXcodeProjectBuildSettingsObject(buildConfiguration.text);
    if (patchedObject !== buildConfiguration.text) {
      next = replacePbxObject(next, buildConfiguration, patchedObject);
    }
  }

  return next;
}

function createPbxFileReferenceEntry(source) {
  return `\t\t${source.fileRefId} /* ${source.name} */ = {isa = PBXFileReference; explicitFileType = ${source.explicitFileType}; fileEncoding = 4; name = ${source.name}; path = "${source.path}"; sourceTree = SOURCE_ROOT; };`;
}

function createPbxSourceBuildFileEntry(source) {
  return `\t\t${source.buildFileId} /* ${source.name} in Sources */ = {isa = PBXBuildFile; fileRef = ${source.fileRefId} /* ${source.name} */; };`;
}

function getAppNativeTarget(content) {
  return findPbxObject(
    content,
    'PBXNativeTarget',
    (object) =>
      object.text.includes('isa = PBXNativeTarget;') &&
      object.text.includes('productType = "com.apple.product-type.application";'),
  );
}

function getNativeTargetSourcesPhaseId(targetText) {
  const buildPhasesMatch = targetText.match(/buildPhases = \(\n([\s\S]*?)^\s*\);/m);
  if (!buildPhasesMatch) {
    return null;
  }

  const sourcesMatch = buildPhasesMatch[1].match(/^\s*([A-Za-z0-9]{24}) \/\* Sources \*\/,\s*$/m);
  return sourcesMatch?.[1] || null;
}

function createPbxSourcesBuildPhaseEntry(phaseId) {
  return `\t\t${phaseId} /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};`;
}

function ensureNativeTargetSourcesPhase(content, appTarget) {
  const existingSourcesPhaseId = getNativeTargetSourcesPhaseId(appTarget.text);
  if (existingSourcesPhaseId) {
    return {
      content,
      sourcesPhaseId: existingSourcesPhaseId,
    };
  }

  let next = ensurePbxSectionEntry(
    content,
    'PBXSourcesBuildPhase',
    createPbxSourcesBuildPhaseEntry(IOS_NATIVE_SOURCES_BUILD_PHASE_ID),
    IOS_NATIVE_SOURCES_BUILD_PHASE_ID,
  );

  const refreshedTarget = findPbxObject(
    next,
    'PBXNativeTarget',
    (object) => object.id === appTarget.id,
  );
  if (!refreshedTarget) {
    return {
      content: next,
      sourcesPhaseId: IOS_NATIVE_SOURCES_BUILD_PHASE_ID,
    };
  }

  const patchedTargetText = ensurePbxListItem(
    refreshedTarget.text,
    'buildPhases',
    `${IOS_NATIVE_SOURCES_BUILD_PHASE_ID} /* Sources */,`,
  );
  if (patchedTargetText !== refreshedTarget.text) {
    next = replacePbxObject(next, refreshedTarget, patchedTargetText);
  }

  return {
    content: next,
    sourcesPhaseId: IOS_NATIVE_SOURCES_BUILD_PHASE_ID,
  };
}

function ensurePbxSourceBuildFile(content, source) {
  const existingBuildFile = findPbxObject(
    content,
    'PBXBuildFile',
    (object) => object.comment === `${source.name} in Sources`,
  );

  if (existingBuildFile) {
    return {
      content,
      buildFileId: existingBuildFile.id,
    };
  }

  return {
    content: ensurePbxSectionEntry(
      content,
      'PBXBuildFile',
      createPbxSourceBuildFileEntry(source),
      source.buildFileId,
    ),
    buildFileId: source.buildFileId,
  };
}

function ensurePbxFileReference(content, source) {
  const existingFileReference = findPbxObject(
    content,
    'PBXFileReference',
    (object) =>
      object.comment === source.name &&
      (object.text.includes(`path = "${source.path}";`) ||
        object.text.includes(`path = ${source.path};`)),
  );

  if (existingFileReference) {
    return {
      content,
      fileRefId: existingFileReference.id,
    };
  }

  return {
    content: ensurePbxSectionEntry(
      content,
      'PBXFileReference',
      createPbxFileReferenceEntry(source),
      source.fileRefId,
    ),
    fileRefId: source.fileRefId,
  };
}

function ensurePbxSourcesPhaseBuildFile(content, sourcesPhaseId, source, buildFileId) {
  const sourcesPhase = findPbxObject(
    content,
    'PBXSourcesBuildPhase',
    (object) => object.id === sourcesPhaseId,
  );
  if (!sourcesPhase) {
    return content;
  }

  const patchedSourcesPhaseText = ensurePbxListItem(
    sourcesPhase.text,
    'files',
    `${buildFileId} /* ${source.name} in Sources */,`,
  );
  if (patchedSourcesPhaseText === sourcesPhase.text) {
    return content;
  }

  return replacePbxObject(content, sourcesPhase, patchedSourcesPhaseText);
}

function patchIosXcodeProjectNativeSources(content) {
  const appTarget = getAppNativeTarget(content);
  if (!appTarget) {
    return content;
  }

  let next = content;
  const sourcesPhaseResult = ensureNativeTargetSourcesPhase(next, appTarget);
  next = sourcesPhaseResult.content;

  for (const source of IOS_NATIVE_SOURCE_FILES) {
    const fileReferenceResult = ensurePbxFileReference(next, source);
    next = fileReferenceResult.content;

    const buildFileResult = ensurePbxSourceBuildFile(next, {
      ...source,
      fileRefId: fileReferenceResult.fileRefId,
    });
    next = buildFileResult.content;

    next = ensurePbxSourcesPhaseBuildFile(
      next,
      sourcesPhaseResult.sourcesPhaseId,
      source,
      buildFileResult.buildFileId,
    );
  }

  return next;
}

function patchIosWorkspaceSettingsForSwiftPackage(content) {
  const buildLocationPattern = /(<key>\s*BuildLocationStyle\s*<\/key>\s*<string>)[^<]*(<\/string>)/m;
  if (buildLocationPattern.test(content)) {
    return content.replace(buildLocationPattern, '$1Unique$2');
  }

  if (content.includes('</dict>')) {
    return content.replace(
      /([ \t]*<\/dict>)/,
      '\t<key>BuildLocationStyle</key>\n\t<string>Unique</string>\n$1',
    );
  }

  return IOS_WORKSPACE_SETTINGS_TEMPLATE;
}

function patchIosXcodeProjectSwiftPackage(content) {
  const packageName = getIosSwiftPackageName();
  const packageComment = `XCRemoteSwiftPackageReference "${packageName}"`;
  const packageProduct = sdkConfig.ios.packageProduct;
  const packageUrlPattern = new RegExp(
    `repositoryURL = "?${escapeRegExp(sdkConfig.ios.packageUrl)}"?;`,
  );

  const appTarget = findPbxObject(
    content,
    'PBXNativeTarget',
    (object) =>
      object.text.includes('isa = PBXNativeTarget;') &&
      object.text.includes('productType = "com.apple.product-type.application";'),
  );
  if (!appTarget) {
    return content;
  }

  const frameworksPhaseMatch = appTarget.text.match(/^\s*([A-Za-z0-9]{24}) \/\* Frameworks \*\/,\s*$/m);
  if (!frameworksPhaseMatch) {
    return content;
  }
  const frameworksPhaseId = frameworksPhaseMatch[1];

  const projectObject = findPbxObject(
    content,
    'PBXProject',
    (object) => object.text.includes('isa = PBXProject;'),
  );
  if (!projectObject) {
    return content;
  }

  const existingPackageRef = findPbxObject(
    content,
    'XCRemoteSwiftPackageReference',
    (object) => packageUrlPattern.test(object.text),
  );
  const packageRefId = existingPackageRef?.id || IOS_SPM_PACKAGE_REF_ID;
  const packageRefEntry = `\t\t${packageRefId} /* ${packageComment} */ = {
\t\t\tisa = XCRemoteSwiftPackageReference;
\t\t\trepositoryURL = "${sdkConfig.ios.packageUrl}";
\t\t\trequirement = {
\t\t\t\tkind = exactVersion;
\t\t\t\tversion = ${sdkConfig.ios.packageVersion};
\t\t\t};
\t\t};`;

  let next = content;
  if (existingPackageRef) {
    const patchedPackageRef = patchIosSwiftPackageRequirement(existingPackageRef);
    next = replacePbxObject(next, existingPackageRef, patchedPackageRef);
  } else {
    next = ensurePbxSectionEntry(
      next,
      'XCRemoteSwiftPackageReference',
      packageRefEntry,
      packageRefId,
    );
  }

  const existingProduct = findPbxObject(
    next,
    'XCSwiftPackageProductDependency',
    (object) => object.text.includes(`productName = ${packageProduct};`),
  );
  const productId = existingProduct?.id || IOS_SPM_PRODUCT_ID;
  const productEntry = `\t\t${productId} /* ${packageProduct} */ = {
\t\t\tisa = XCSwiftPackageProductDependency;
\t\t\tpackage = ${packageRefId} /* ${packageComment} */;
\t\t\tproductName = ${packageProduct};
\t\t};`;

  if (!existingProduct) {
    next = ensurePbxSectionEntry(
      next,
      'XCSwiftPackageProductDependency',
      productEntry,
      productId,
    );
  }

  const buildFile = findPbxObject(
    next,
    'PBXBuildFile',
    (object) => object.text.includes(`productRef = ${productId} /* ${packageProduct} */;`),
  );
  const buildFileId = buildFile?.id || IOS_SPM_BUILD_FILE_ID;
  const buildFileEntry = `\t\t${buildFileId} /* ${packageProduct} in Frameworks */ = {isa = PBXBuildFile; productRef = ${productId} /* ${packageProduct} */; };`;

  if (!buildFile) {
    next = ensurePbxSectionEntry(next, 'PBXBuildFile', buildFileEntry, buildFileId);
  }

  const patchedProjectObject = ensurePbxListItem(
    findPbxObject(next, 'PBXProject', (object) => object.id === projectObject.id).text,
    'packageReferences',
    `${packageRefId} /* ${packageComment} */,`,
  );
  next = replacePbxObject(
    next,
    findPbxObject(next, 'PBXProject', (object) => object.id === projectObject.id),
    patchedProjectObject,
  );

  const patchedTargetObject = ensurePbxListItem(
    findPbxObject(next, 'PBXNativeTarget', (object) => object.id === appTarget.id).text,
    'packageProductDependencies',
    `${productId} /* ${packageProduct} */,`,
  );
  next = replacePbxObject(
    next,
    findPbxObject(next, 'PBXNativeTarget', (object) => object.id === appTarget.id),
    patchedTargetObject,
  );

  const patchedFrameworksObject = ensurePbxListItem(
    findPbxObject(next, 'PBXFrameworksBuildPhase', (object) => object.id === frameworksPhaseId).text,
    'files',
    `${buildFileId} /* ${packageProduct} in Frameworks */,`,
  );
  next = replacePbxObject(
    next,
    findPbxObject(next, 'PBXFrameworksBuildPhase', (object) => object.id === frameworksPhaseId),
    patchedFrameworksObject,
  );

  return patchIosXcodeProjectBuildSettingsForSwiftPackage(next);
}

function applyAndroidGradleDependencies(content) {
  const dependencyLines = sdkConfig.android.dependencies.map(
    (dependency) => `implementation '${dependency}'`,
  );

  if (dependencyLines.every((dependency) => content.includes(dependency))) {
    return content;
  }

  const injection = dependencyLines.map((dependency) => `    ${dependency}`).join('\n');

  if (/dependencies\s*\{/.test(content)) {
    return content.replace(/dependencies\s*\{/, (match) => `${match}\n${injection}`);
  }

  return `${content.trimEnd()}\n\ndependencies {\n${injection}\n}\n`;
}

function ensureAgoraLocalMavenRepository(content) {
  if (content.includes('local-maven')) {
    return content;
  }

  const localMavenPath = sdkConfig.android.localMavenRelativePath;
  const header = `def localAgoraRepo = new File(NATIVE_DIR, "${localMavenPath}")\n\n`;
  const repositoryInjection = [
    `        if (new File(NATIVE_DIR, "${localMavenPath}").exists()) {`,
    `            maven { url uri(new File(NATIVE_DIR, "${localMavenPath}")) }`,
    '        }',
  ].join('\n');

  let next = content;
  if (!next.includes('def localAgoraRepo')) {
    next = header + next;
  }
  next = next.replace(/repositories\s*\{/g, (match) => `${match}\n${repositoryInjection}`);
  return next;
}

function rewriteAndroidGradlePluginVersion(content) {
  return content.replace(
    /com\.android\.tools\.build:gradle:[0-9.]+/g,
    `com.android.tools.build:gradle:${sdkConfig.android.gradlePluginVersion}`,
  );
}

function rewriteGradleDistributionUrl(content) {
  return content.replace(
    /distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-[^\\]+-bin\.zip/g,
    `distributionUrl=${sdkConfig.android.gradleDistributionUrl}`,
  );
}

async function findFirstExistingPath(rootDir, candidates) {
  for (const candidate of candidates) {
    const absolutePath = path.join(rootDir, candidate);
    try {
      await access(absolutePath);
      return absolutePath;
    } catch {
      continue;
    }
  }

  return null;
}

async function ensureIosSetupGuide(rootDir) {
  const filePath = path.join(rootDir, IOS_GUIDE_RELATIVE_PATH);
  await mkdir(path.dirname(filePath), { recursive: true });

  const content = `# Agora RTC iOS Swift Package Manager Setup

Repository: ${sdkConfig.ios.packageUrl}
Version: ${sdkConfig.ios.packageVersion}
Package: ${sdkConfig.ios.packageProduct}

## Steps

1. Open the exported Xcode project.
2. Add a Swift Package dependency from the repository above.
3. Pin the dependency to tag ${sdkConfig.ios.packageVersion}.
4. Link the package product to the app target.
5. Copy the bridge sources from the plugin template into the exported iOS project if they are not already present.
`;

  await writeFile(filePath, content, 'utf8');
  return filePath;
}

async function copyTemplateFile(rootDir, sourceRelativePath, destinationRelativePath) {
  const sourcePath = path.resolve(__dirname, '..', sourceRelativePath);
  const destinationPath = path.join(rootDir, destinationRelativePath);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return destinationPath;
}

async function copyTemplateDirectory(rootDir, sourceRelativePath, destinationRelativePath) {
  const sourcePath = path.resolve(__dirname, '..', sourceRelativePath);
  const destinationPath = path.join(rootDir, destinationRelativePath);

  await mkdir(destinationPath, { recursive: true });
  await cp(sourcePath, destinationPath, {
    recursive: true,
    force: true,
  });
  return destinationPath;
}

function patchNativeCommonCMakeTextureBridge(content) {
  if (content.includes('Classes/agora/AgoraEngineTextureBridge.cpp')) {
    const guardedBlockPattern = /if\(NOT APPLE\)\s*list\(APPEND CC_COMMON_SOURCES\s+\$\{CMAKE_CURRENT_LIST_DIR\}\/Classes\/agora\/AgoraEngineTextureBridge\.h\s+\$\{CMAKE_CURRENT_LIST_DIR\}\/Classes\/agora\/AgoraEngineTextureBridge\.cpp\s*\)\s*endif\(\)/;
    if (guardedBlockPattern.test(content)) {
      return content.replace(guardedBlockPattern, COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK);
    }
    if (content.includes(COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK)) {
      return content;
    }
    return content;
  }

  return `${content.trimEnd()}

${COMMON_ENGINE_TEXTURE_BRIDGE_CMAKE_BLOCK}
`;
}

function sanitizeIosCMakeSwiftBridge(content) {
  return content
    .replace(
      /^([ \t]*project\([^)\n]*?)\s+Swift(\s*\)[ \t]*)$/gm,
      '$1$2',
    )
    .replace(
      /^[ \t]*\$\{CMAKE_CURRENT_LIST_DIR\}\/agora-rtc\/AgoraRtcBridge\.swift\s*\n/gm,
      '',
    );
}

function patchIosCMakeRtcBridgeSources(content) {
  const next = sanitizeIosCMakeSwiftBridge(content);

  if (next.includes('agora-rtc/AgoraRtcPlugin.mm')) {
    return next.includes('CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION')
      ? next
      : `${next.trimEnd()}

set(CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "${sdkConfig.ios.swiftVersion}")
`;
  }

  const includeAnchor = 'include(${CC_PROJECT_DIR}/../common/CMakeLists.txt)';
  if (next.includes(includeAnchor)) {
    return next.replace(includeAnchor, `${includeAnchor}

${IOS_RTC_BRIDGE_CMAKE_BLOCK}`);
  }

  return `${next.trimEnd()}

${IOS_RTC_BRIDGE_CMAKE_BLOCK}
`;
}

function patchNativeGameTextureBridgeRegistration(content) {
  let next = content;

  if (!next.includes('#include "agora/AgoraEngineTextureBridge.h"')) {
    const importAnchor = '#include "Game.h"';
    next = next.includes(importAnchor)
      ? next.replace(importAnchor, `${importAnchor}\n\n#include "agora/AgoraEngineTextureBridge.h"`)
      : `#include "agora/AgoraEngineTextureBridge.h"\n\n${next}`;
  }

  if (!next.includes('register_all_agora_engine_texture')) {
    const initAnchor = '  BaseGame::init();';
    const registration = `  auto *seengine = se::ScriptEngine::getInstance();
  seengine->addRegisterCallback(agora::cocos::register_all_agora_engine_texture);
  seengine->addBeforeCleanupHook([]() {
    agora::cocos::reset_agora_engine_texture_registry();
  });
`;

    if (!next.includes(initAnchor)) {
      throw new Error('Unable to patch native Game.cpp: BaseGame::init anchor not found.');
    }
    next = next.replace(initAnchor, `${registration}\n${initAnchor}`);
  }

  return next;
}

async function ensureNativeEngineTextureBridge(nativeCommonDir) {
  const destinationDir = path.join(nativeCommonDir, 'Classes', 'agora');
  await mkdir(destinationDir, { recursive: true });

  for (const filename of COMMON_ENGINE_TEXTURE_BRIDGE_FILES) {
    await copyTemplateFile(
      nativeCommonDir,
      `templates/common/Classes/agora/${filename}`,
      `Classes/agora/${filename}`,
    );
  }

  const cmakePath = path.join(nativeCommonDir, 'CMakeLists.txt');
  try {
    const original = await readFile(cmakePath, 'utf8');
    const patched = patchNativeCommonCMakeTextureBridge(original);
    if (patched !== original) {
      await writeFile(cmakePath, patched, 'utf8');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const gamePath = path.join(nativeCommonDir, 'Classes', 'Game.cpp');
  try {
    const original = await readFile(gamePath, 'utf8');
    const patched = patchNativeGameTextureBridgeRegistration(original);
    if (patched !== original) {
      await writeFile(gamePath, patched, 'utf8');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function ensureNativeEngineTextureBridgeForExport(rootDir) {
  const nativeCommonDir = await findFirstExistingPath(rootDir, [
    '../../native/engine/common',
    '../../../native/engine/common',
    '../native/engine/common',
    'native/engine/common',
  ]);

  if (nativeCommonDir) {
    await ensureNativeEngineTextureBridge(nativeCommonDir);
  }
}

async function copyIosTemplateFiles(destinationRoot, nestedInNativeSourceDir = false) {
  const iosTemplateFiles = [
    'AgoraRtcBridge.swift',
    'AgoraRtcPlugin.mm',
    'AgoraEngineTextureSlotBridge.h',
    'AgoraEngineTextureSlotBridge.mm',
  ];

  for (const filename of iosTemplateFiles) {
    await copyTemplateFile(
      destinationRoot,
      `templates/ios/${filename}`,
      nestedInNativeSourceDir ? `agora-rtc/${filename}` : filename,
    );
  }
}

function patchIosAppDelegateBridgeAttachment(content) {
  let next = content;

  if (!next.includes('@interface AgoraRtcPlugin : NSObject')) {
    const importAnchor = '#import "service/SDKWrapper.h"';
    if (next.includes(importAnchor)) {
      next = next.replace(
        importAnchor,
        `${importAnchor}\n\n${IOS_APP_DELEGATE_FORWARD_DECLARATION}`,
      );
    } else {
      next = `${IOS_APP_DELEGATE_FORWARD_DECLARATION}\n\n${next}`;
    }
  }

  if (!next.includes('[[AgoraRtcPlugin sharedInstance] attachBridge]')) {
    const launchAnchor = '[appDelegateBridge application:application didFinishLaunchingWithOptions:launchOptions];';
    if (!next.includes(launchAnchor)) {
      throw new Error('Unable to patch iOS AppDelegate: launch anchor not found.');
    }
    next = next.replace(launchAnchor, `${launchAnchor}\n${IOS_APP_DELEGATE_ATTACH_CALL}`);
  }

  return next;
}

async function ensureIosAppDelegateBridgeAttachment(nativeSourceDir) {
  const appDelegatePath = path.join(nativeSourceDir, 'AppDelegate.mm');
  try {
    await access(appDelegatePath);
  } catch {
    return null;
  }

  const original = await readFile(appDelegatePath, 'utf8');
  const patched = patchIosAppDelegateBridgeAttachment(original);

  if (patched !== original) {
    await writeFile(appDelegatePath, patched, 'utf8');
  }

  return appDelegatePath;
}

async function ensureIosCMakeRtcBridgeSources(nativeSourceDir) {
  const cmakePath = path.join(nativeSourceDir, 'CMakeLists.txt');
  try {
    const original = await readFile(cmakePath, 'utf8');
    const patched = patchIosCMakeRtcBridgeSources(original);
    if (patched !== original) {
      await writeFile(cmakePath, patched, 'utf8');
    }
    return cmakePath;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    return null;
  }
}

async function findIosXcodeProjectFiles(rootDir) {
  const searchRoots = [
    rootDir,
    path.join(rootDir, 'proj'),
    path.join(rootDir, 'build', 'ios', 'proj'),
  ];
  const candidates = [];
  const seenRoots = new Set();

  for (const searchRoot of searchRoots) {
    if (seenRoots.has(searchRoot)) {
      continue;
    }
    seenRoots.add(searchRoot);

    let entries;
    try {
      entries = await readdir(searchRoot, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(searchRoot, entry.name);
      if (entry.isDirectory() && entry.name.endsWith('.xcodeproj')) {
        candidates.push(path.join(fullPath, 'project.pbxproj'));
      }
    }
  }

  return [...new Set(candidates)];
}

async function findIosWorkspaceSettingsFiles(pbxprojPath) {
  const xcodeProjectDir = path.dirname(pbxprojPath);
  const workspaceDir = path.join(xcodeProjectDir, 'project.xcworkspace');
  const settingsPaths = [
    path.join(workspaceDir, 'xcshareddata', 'WorkspaceSettings.xcsettings'),
  ];

  async function collectUserWorkspaceSettings(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await collectUserWorkspaceSettings(fullPath);
      } else if (entry.isFile() && entry.name === 'WorkspaceSettings.xcsettings') {
        settingsPaths.push(fullPath);
      }
    }
  }

  await collectUserWorkspaceSettings(path.join(workspaceDir, 'xcuserdata'));
  return [...new Set(settingsPaths)];
}

async function ensureIosWorkspaceSettingsForSwiftPackage(pbxprojPath) {
  const patchedPaths = [];
  for (const settingsPath of await findIosWorkspaceSettingsFiles(pbxprojPath)) {
    let original;
    let shouldCreate = false;
    try {
      original = await readFile(settingsPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      shouldCreate = true;
      original = IOS_WORKSPACE_SETTINGS_TEMPLATE;
    }

    const patched = patchIosWorkspaceSettingsForSwiftPackage(original);
    if (shouldCreate || patched !== original) {
      await mkdir(path.dirname(settingsPath), { recursive: true });
      await writeFile(settingsPath, patched, 'utf8');
      patchedPaths.push(settingsPath);
    }
  }

  return patchedPaths;
}

async function ensureIosXcodeProjectSwiftPackage(rootDir) {
  const pbxprojPaths = await findIosXcodeProjectFiles(rootDir);
  const patchedPaths = [];

  for (const pbxprojPath of pbxprojPaths) {
    let original;
    try {
      original = await readFile(pbxprojPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    const patched = patchIosXcodeProjectSwiftPackage(original);
    if (patched !== original) {
      await writeFile(pbxprojPath, patched, 'utf8');
      patchedPaths.push(pbxprojPath);
    }

    patchedPaths.push(...await ensureIosWorkspaceSettingsForSwiftPackage(pbxprojPath));
  }

  return patchedPaths;
}

async function ensureIosXcodeProjectNativeSources(rootDir) {
  const pbxprojPaths = await findIosXcodeProjectFiles(rootDir);
  const patchedPaths = [];

  for (const pbxprojPath of pbxprojPaths) {
    let original;
    try {
      original = await readFile(pbxprojPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    const patched = patchIosXcodeProjectNativeSources(original);
    if (patched !== original) {
      await writeFile(pbxprojPath, patched, 'utf8');
      patchedPaths.push(pbxprojPath);
    }
  }

  return patchedPaths;
}

function patchAndroidAppActivityBridgeAttachment(content) {
  let next = content;

  if (!next.includes(ANDROID_APP_ACTIVITY_IMPORT)) {
    const packageMatch = next.match(/^(package\s+[\w.]+;\s*)$/m);
    if (packageMatch) {
      next = next.replace(packageMatch[0], `${packageMatch[0]}\n${ANDROID_APP_ACTIVITY_IMPORT}`);
    } else {
      next = `${ANDROID_APP_ACTIVITY_IMPORT}\n\n${next}`;
    }
  }

  if (!next.includes('AgoraRtcPlugin.getInstance().attachBridge()')) {
    const launchAnchor = 'SDKWrapper.shared().init(this);';
    if (!next.includes(launchAnchor)) {
      throw new Error('Unable to patch Android AppActivity: SDKWrapper init anchor not found.');
    }
    next = next.replace(launchAnchor, `${launchAnchor}\n${ANDROID_APP_ACTIVITY_ATTACH_CALL}`);
  }

  if (!next.includes('AgoraRtcPlugin.getInstance().onRequestPermissionsResult')) {
    const permissionCallbackMatch = next.match(
      /public\s+void\s+onRequestPermissionsResult\s*\(\s*int\s+requestCode\s*,\s*String\[\]\s+permissions\s*,\s*int\[\]\s+grantResults\s*\)\s*\{/,
    );
    if (permissionCallbackMatch) {
      const superCall = 'super.onRequestPermissionsResult(requestCode, permissions, grantResults);';
      next = next.includes(superCall)
        ? next.replace(superCall, `${superCall}\n${ANDROID_APP_ACTIVITY_PERMISSION_FORWARD_CALL}`)
        : next.replace(
          permissionCallbackMatch[0],
          `${permissionCallbackMatch[0]}\n${ANDROID_APP_ACTIVITY_PERMISSION_FORWARD_CALL}`,
        );
    } else {
      const classEndIndex = next.lastIndexOf('}');
      if (classEndIndex < 0) {
        throw new Error('Unable to patch Android AppActivity: class closing brace not found.');
      }
      next = `${next.slice(0, classEndIndex).trimEnd()}\n\n${ANDROID_APP_ACTIVITY_PERMISSION_FORWARDER}${next.slice(classEndIndex)}`;
    }
  }

  return next;
}

async function ensureAndroidAppActivityBridgeAttachment(androidRootDir) {
  const appActivityPath = await findFirstExistingPath(androidRootDir, [
    'app/src/com/cocos/game/AppActivity.java',
    'app/src/main/java/com/cocos/game/AppActivity.java',
    'src/com/cocos/game/AppActivity.java',
    'src/main/java/com/cocos/game/AppActivity.java',
    'AppActivity.java',
  ]);

  if (!appActivityPath) {
    return null;
  }

  const original = await readFile(appActivityPath, 'utf8');
  const patched = patchAndroidAppActivityBridgeAttachment(original);

  if (patched !== original) {
    await writeFile(appActivityPath, patched, 'utf8');
  }

  return appActivityPath;
}

function patchAndroidRtcPermissions(content) {
  const missingPermissions = ANDROID_RTC_PERMISSIONS.filter(
    (permission) => !content.includes(`android:name="${permission}"`),
  );

  if (missingPermissions.length === 0) {
    return content;
  }

  const permissionBlock = missingPermissions
    .map((permission) => `    <uses-permission android:name="${permission}" />`)
    .join('\n');

  if (content.includes('<application')) {
    return content.replace(/(\s*<application\b)/, `\n${permissionBlock}\n$1`);
  }

  return content.replace(/(<manifest\b[^>]*>)/, `$1\n\n${permissionBlock}`);
}

async function ensureAndroidRtcPermissions(androidRootDir) {
  const manifestPath = await findFirstExistingPath(androidRootDir, [
    'app/src/main/AndroidManifest.xml',
    'app/AndroidManifest.xml',
    'native/engine/android/app/AndroidManifest.xml',
    '../../native/engine/android/app/AndroidManifest.xml',
    '../../../native/engine/android/app/AndroidManifest.xml',
    '../native/engine/android/app/AndroidManifest.xml',
  ]);

  if (!manifestPath) {
    return null;
  }

  const original = await readFile(manifestPath, 'utf8');
  const patched = patchAndroidRtcPermissions(original);

  if (patched !== original) {
    await writeFile(manifestPath, patched, 'utf8');
  }

  return manifestPath;
}

function patchIosRtcUsageDescriptions(content) {
  const missingEntries = Object.entries(IOS_RTC_USAGE_DESCRIPTIONS).filter(
    ([key]) => !content.includes(`<key>${key}</key>`),
  );

  if (missingEntries.length === 0) {
    return content;
  }

  const usageBlock = missingEntries
    .map(([key, value]) => `\t<key>${key}</key>\n\t<string>${value}</string>`)
    .join('\n');

  const dictEndIndex = content.lastIndexOf('</dict>');
  if (dictEndIndex >= 0) {
    return `${content.slice(0, dictEndIndex).trimEnd()}\n${usageBlock}\n${content.slice(dictEndIndex)}`;
  }

  return content;
}

async function ensureIosRtcUsageDescriptions(rootDir) {
  const infoPlistPath = await findFirstExistingPath(rootDir, [
    'Info.plist',
    'proj/Info.plist',
    'native/engine/ios/Info.plist',
    '../../native/engine/ios/Info.plist',
    '../../../native/engine/ios/Info.plist',
    '../native/engine/ios/Info.plist',
  ]);

  if (!infoPlistPath) {
    return null;
  }

  const original = await readFile(infoPlistPath, 'utf8');
  const patched = patchIosRtcUsageDescriptions(original);

  if (patched !== original) {
    await writeFile(infoPlistPath, patched, 'utf8');
  }

  return infoPlistPath;
}

async function integrateAndroidExport(rootDir) {
  await ensureNativeEngineTextureBridgeForExport(rootDir);

  const androidSourceDir = await findFirstExistingPath(rootDir, [
    '../../native/engine/android',
    '../../../native/engine/android',
    '../native/engine/android',
    'native/engine/android',
    'proj',
    'android/proj',
  ]);
  if (androidSourceDir) {
    await ensureAndroidAppActivityBridgeAttachment(androidSourceDir);
    await ensureAndroidRtcPermissions(androidSourceDir);
  }

  const appGradleFile = await findFirstExistingPath(rootDir, [
    'native/engine/android/app/build.gradle',
    '../../native/engine/android/app/build.gradle',
    '../native/engine/android/app/build.gradle',
    'proj/app/build.gradle',
    'proj/android/app/build.gradle',
    'build/android/proj/app/build.gradle',
    'android/app/build.gradle',
  ]);

  if (appGradleFile) {
    const original = await readFile(appGradleFile, 'utf8');
    await writeFile(appGradleFile, applyAndroidGradleDependencies(original), 'utf8');
  }

  const rootGradleFiles = [
    await findFirstExistingPath(rootDir, ['native/engine/android/build.gradle']),
    await findFirstExistingPath(rootDir, ['../../native/engine/android/build.gradle']),
    await findFirstExistingPath(rootDir, ['proj/build.gradle']),
  ].filter(Boolean);

  for (const gradleFile of rootGradleFiles) {
    const original = await readFile(gradleFile, 'utf8');
    const withVersion = rewriteAndroidGradlePluginVersion(original);
    const withRepo = ensureAgoraLocalMavenRepository(withVersion);
    await writeFile(gradleFile, withRepo, 'utf8');
  }

  const wrapperProperties = await findFirstExistingPath(rootDir, [
    'proj/gradle/wrapper/gradle-wrapper.properties',
  ]);
  if (wrapperProperties) {
    const original = await readFile(wrapperProperties, 'utf8');
    await writeFile(wrapperProperties, rewriteGradleDistributionUrl(original), 'utf8');
  }

  await copyTemplateDirectory(
    rootDir,
    'templates/android/src/main/java/io/agora/cocos/rtc',
    '../../native/engine/android/app/src/main/java/io/agora/cocos/rtc',
  );
}

async function integrateIosExport(rootDir) {
  await ensureIosSetupGuide(rootDir);
  await ensureNativeEngineTextureBridgeForExport(rootDir);

  const iosProjectDir = await findFirstExistingPath(rootDir, ['proj']);
  const nativeSourceDir = await findFirstExistingPath(rootDir, [
    '../../native/engine/ios',
    '../native/engine/ios',
    'native/engine/ios',
  ]);

  const destinations = [];
  if (nativeSourceDir) {
    destinations.push(nativeSourceDir);
  }
  if (iosProjectDir) {
    destinations.push(path.join(iosProjectDir, 'agora-rtc'));
  }

  for (const destinationRoot of destinations) {
    await copyIosTemplateFiles(destinationRoot, destinationRoot === nativeSourceDir);
  }

  if (nativeSourceDir) {
    await ensureIosAppDelegateBridgeAttachment(nativeSourceDir);
    await ensureIosCMakeRtcBridgeSources(nativeSourceDir);
    await ensureIosRtcUsageDescriptions(nativeSourceDir);
  }

  await ensureIosXcodeProjectNativeSources(rootDir);
  await ensureIosXcodeProjectSwiftPackage(rootDir);
}

function resolveBuildDirectory(options = {}, result = {}) {
  return (
    result?.paths?.output ||
    result?.paths?.dir ||
    result?.dest ||
    options.dest ||
    options.outputDir ||
    options.buildPath ||
    options.projectPath ||
    process.cwd()
  );
}

async function onAfterBuild(options = {}, result = {}) {
  const buildDir = resolveBuildDirectory(options, result);
  const platform = String(
    options.platform || options.actualPlatform || options.name || '',
  ).toLowerCase();

  if (platform === 'android') {
    await integrateAndroidExport(buildDir);
  }

  if (platform === 'ios') {
    await integrateIosExport(buildDir);
  }
}

async function onBeforeMake(rootDir, options = {}) {
  const platform = String(
    options.platform || options.actualPlatform || options.name || '',
  ).toLowerCase();

  if (platform === 'ios' || rootDir.includes('/ios')) {
    await ensureIosXcodeProjectNativeSources(rootDir);
    await ensureIosXcodeProjectSwiftPackage(rootDir);
  }
}

module.exports = {
  applyAndroidGradleDependencies,
  ensureAgoraLocalMavenRepository,
  ensureIosSetupGuide,
  findFirstExistingPath,
  integrateAndroidExport,
  integrateIosExport,
  copyIosTemplateFiles,
  ensureAndroidAppActivityBridgeAttachment,
  ensureAndroidRtcPermissions,
  ensureIosRtcUsageDescriptions,
  ensureIosXcodeProjectSwiftPackage,
  ensureIosXcodeProjectNativeSources,
  ensureIosCMakeRtcBridgeSources,
  ensureNativeEngineTextureBridge,
  ensureIosAppDelegateBridgeAttachment,
  onAfterBuild,
  onBeforeMake,
  patchAndroidAppActivityBridgeAttachment,
  patchAndroidRtcPermissions,
  patchIosRtcUsageDescriptions,
  patchIosXcodeProjectBuildSettingsForSwiftPackage,
  patchIosXcodeProjectNativeSources,
  patchIosWorkspaceSettingsForSwiftPackage,
  patchIosCMakeRtcBridgeSources,
  patchIosXcodeProjectSwiftPackage,
  patchIosAppDelegateBridgeAttachment,
  patchNativeCommonCMakeTextureBridge,
  patchNativeGameTextureBridgeRegistration,
  rewriteAndroidGradlePluginVersion,
  rewriteGradleDistributionUrl,
  sdkConfig,
};
