import { native, sys } from 'cc';

export const AUDIO_EFFECT_URL = 'https://webdemo.agora.io/ding.mp3';
export const AUDIO_MIXING_RESOURCE = 'audio/Agora.io-Interactions.mp3';
export const AUDIO_MIXING_FILE_NAME = 'Agora.io-Interactions.mp3';

type FileUtilsLike = {
  fullPathForFilename?(path: string): string;
  getWritablePath?(): string;
  isFileExist?(path: string): boolean;
  copyFile?(source: string, destination: string): boolean;
};

export function resolveAudioMixingAssetPath(): string {
  if (!sys.isNative) {
    return AUDIO_MIXING_RESOURCE;
  }

  const fileUtils = native.fileUtils as FileUtilsLike | undefined;
  if (!fileUtils) {
    throw new Error('Cocos native fileUtils is unavailable.');
  }

  const source =
    fileUtils.fullPathForFilename?.(`assets/resources/${AUDIO_MIXING_RESOURCE}`) ||
    fileUtils.fullPathForFilename?.(AUDIO_MIXING_RESOURCE) ||
    '';

  if (!source) {
    throw new Error(`Audio mixing asset not found: ${AUDIO_MIXING_RESOURCE}`);
  }

  const writablePath = fileUtils.getWritablePath?.() ?? '';
  if (!writablePath) {
    return source;
  }

  const destination = `${writablePath}${AUDIO_MIXING_FILE_NAME}`;
  if (fileUtils.isFileExist?.(destination)) {
    return destination;
  }

  const copied = fileUtils.copyFile?.(source, destination) ?? false;
  if (!copied) {
    return source;
  }

  return destination;
}
