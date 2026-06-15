import { AudioClip, native, resources, sys } from 'cc';

/** resources.load path (relative to assets/resources, no file extension). */
export const AUDIO_EFFECT_RESOURCE = 'audio/Agora.io-Interactions';
export const AUDIO_EFFECT_FILE_NAME = 'Agora.io-Interactions.mp3';
export const AUDIO_MIXING_RESOURCE = 'audio/Agora.io-Interactions';
export const AUDIO_MIXING_FILE_NAME = 'Agora.io-Interactions.mp3';

type FileUtilsLike = {
  getWritablePath?(): string;
  isFileExist?(path: string): boolean;
  copyFile?(source: string, destination: string): boolean;
  getDataFromFile?(path: string): Uint8Array | ArrayBuffer | null;
  writeDataToFile?(data: Uint8Array | ArrayBuffer, path: string): boolean;
};

let cachedWritableAudioPath: string | null = null;

function getNativeFileUtils(): FileUtilsLike | undefined {
  const jsbUtils = (globalThis as { jsb?: { fileUtils?: FileUtilsLike } }).jsb?.fileUtils;
  if (jsbUtils) {
    return jsbUtils;
  }
  return native.fileUtils as FileUtilsLike | undefined;
}

function normalizeNativePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('file://')) {
    return decodeURIComponent(trimmed.slice('file://'.length));
  }
  return decodeURIComponent(trimmed);
}

function joinWritablePath(directory: string, fileName: string): string {
  if (!directory) {
    return fileName;
  }
  return directory.endsWith('/') ? `${directory}${fileName}` : `${directory}/${fileName}`;
}

function loadBundledAudioClip(resourcePath: string): Promise<AudioClip> {
  return new Promise((resolve, reject) => {
    resources.load(resourcePath, AudioClip, (error, clip) => {
      if (error || !clip) {
        reject(new Error(`Audio asset not found: ${resourcePath} (${String(error)}`));
        return;
      }
      resolve(clip);
    });
  });
}

function copyAudioFile(fileUtils: FileUtilsLike, source: string, destination: string): boolean {
  if (fileUtils.copyFile?.(source, destination)) {
    return true;
  }

  const data = fileUtils.getDataFromFile?.(source);
  if (!data) {
    return false;
  }

  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return fileUtils.writeDataToFile?.(bytes, destination) ?? false;
}

function ensureWritableAudioPath(sourcePath: string, fileName: string): string {
  const fileUtils = getNativeFileUtils();
  if (!fileUtils) {
    throw new Error('Cocos native fileUtils is unavailable.');
  }

  const source = normalizeNativePath(sourcePath);
  if (!source) {
    throw new Error(`Audio asset source path is empty for ${fileName}.`);
  }

  const writablePath = fileUtils.getWritablePath?.() ?? '';
  if (!writablePath) {
    return source;
  }

  const destination = joinWritablePath(writablePath, fileName);
  if (fileUtils.isFileExist?.(destination)) {
    return destination;
  }

  if (!fileUtils.isFileExist?.(source)) {
    throw new Error(`Audio asset source file is missing: ${source}`);
  }

  const copied = copyAudioFile(fileUtils, source, destination);
  if (copied && fileUtils.isFileExist?.(destination)) {
    return destination;
  }

  // resources.load nativeUrl is often already an absolute sandbox path on iOS/Android.
  return source;
}

async function resolveBundledAudioAssetPath(resourcePath: string, fileName: string): Promise<string> {
  if (!sys.isNative) {
    return `${resourcePath}.mp3`;
  }

  const fileUtils = getNativeFileUtils();
  if (cachedWritableAudioPath && fileUtils?.isFileExist?.(cachedWritableAudioPath)) {
    return cachedWritableAudioPath;
  }

  const clip = await loadBundledAudioClip(resourcePath);
  const nativeUrl = clip.nativeUrl?.trim();
  if (!nativeUrl) {
    throw new Error(`Audio asset nativeUrl is empty: ${resourcePath}`);
  }

  const resolvedPath = ensureWritableAudioPath(nativeUrl, fileName);
  cachedWritableAudioPath = resolvedPath;
  return resolvedPath;
}

export async function resolveAudioEffectAssetPath(): Promise<string> {
  return resolveBundledAudioAssetPath(AUDIO_EFFECT_RESOURCE, AUDIO_EFFECT_FILE_NAME);
}

export async function resolveAudioMixingAssetPath(): Promise<string> {
  return resolveBundledAudioAssetPath(AUDIO_MIXING_RESOURCE, AUDIO_MIXING_FILE_NAME);
}
