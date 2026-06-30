import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.env.COCOS_BUILD_SOURCE_CONFIG || process.env.ANDROID_BUILD_CONFIG;
const outputPath = process.env.COCOS_BUILD_OUTPUT_CONFIG || process.env.ANDROID_COCOS_BUILD_CONFIG;
const sdkRoot = process.env.ANDROID_SDK_ROOT;
const ndkHome = process.env.ANDROID_NDK_HOME;

if (!sourcePath || !outputPath) {
  throw new Error(
    'COCOS_BUILD_SOURCE_CONFIG and COCOS_BUILD_OUTPUT_CONFIG (or ANDROID_BUILD_CONFIG and ANDROID_COCOS_BUILD_CONFIG) are required.',
  );
}

if (!sdkRoot || !ndkHome) {
  throw new Error('ANDROID_SDK_ROOT and ANDROID_NDK_HOME are required.');
}

const config = JSON.parse(await readFile(sourcePath, 'utf8'));
const platform = config.platform || 'android';

config.packages ??= {};
config.packages[platform] ??= {};
config.packages[platform].sdkPath = sdkRoot;
config.packages[platform].ndkPath = ndkHome;

await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
