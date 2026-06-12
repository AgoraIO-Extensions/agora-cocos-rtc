import { native, sys } from 'cc';

export const AUDIO_EFFECT_RESOURCE = 'audio/Agora.io-Interactions.mp3';
export const AUDIO_EFFECT_FILE_NAME = 'Agora.io-Interactions.mp3';
export const AUDIO_MIXING_RESOURCE = 'audio/Agora.io-Interactions.mp3';
export const AUDIO_MIXING_FILE_NAME = 'Agora.io-Interactions.mp3';

type FileUtilsLike = {
  fullPathForFilename?(path: string): string;
  getWritablePath?(): string;
  isFileExist?(path: string): boolean;
  copyFile?(source: string, destination: string): boolean;
};

function resolveBundledAudioAssetPath(resourcePath: string, fileName: string): string {
  if (!sys.isNative) {
    return resourcePath;
  }

  const fileUtils = native.fileUtils as FileUtilsLike | undefined;
  if (!fileUtils) {
    throw new Error('Cocos native fileUtils is unavailable.');
  }

  const source =
    fileUtils.fullPathForFilename?.(`assets/resources/${resourcePath}`) ||
    fileUtils.fullPathForFilename?.(resourcePath) ||
    '';

  if (!source) {
    throw new Error(`Audio asset not found: ${resourcePath}`);
  }

  const writablePath = fileUtils.getWritablePath?.() ?? '';
  if (!writablePath) {
    return source;
  }

  const destination = `${writablePath}${fileName}`;
  if (fileUtils.isFileExist?.(destination)) {
    return destination;
  }

  const copied = fileUtils.copyFile?.(source, destination) ?? false;
  if (!copied) {
    return source;
  }

  return destination;
}

export function resolveAudioEffectAssetPath(): string {
  return resolveBundledAudioAssetPath(AUDIO_EFFECT_RESOURCE, AUDIO_EFFECT_FILE_NAME);
}

export function resolveAudioMixingAssetPath(): string {
  return resolveBundledAudioAssetPath(AUDIO_MIXING_RESOURCE, AUDIO_MIXING_FILE_NAME);
}
