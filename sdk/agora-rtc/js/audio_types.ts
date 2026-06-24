/**
 * Native audio profile values used by setAudioProfile.
 *
 * These map to the iOS `AgoraAudioProfile` / Android audio profile integer values.
 */
export const AgoraAudioProfile = {
  /** Use the SDK default profile for the active channel profile. */
  Default: 0,
  /** Speech-oriented mono audio. */
  SpeechStandard: 1,
  /** Music mono audio with standard quality. */
  MusicStandard: 2,
  /** Music stereo audio with standard quality. */
  MusicStandardStereo: 3,
  /** Music mono audio with high quality. */
  MusicHighQuality: 4,
  /** Music stereo audio with high quality. */
  MusicHighQualityStereo: 5,
  /** IoT-oriented mono audio. */
  Iot: 6,
} as const;

export type AgoraAudioProfileValue =
  (typeof AgoraAudioProfile)[keyof typeof AgoraAudioProfile] | number;

/**
 * Native audio scenario values used by setAudioProfile.
 *
 * These map to the iOS `AgoraAudioScenario` / Android audio scenario integer values.
 */
export const AgoraAudioScenario = {
  /** Let the SDK choose an audio scenario. */
  Default: 0,
  /** High-fidelity game streaming / live gaming scenario. */
  GameStreaming: 3,
  /** Chatroom scenario. */
  Chatroom: 5,
  /** Real-time chorus scenario. */
  Chorus: 7,
  /** Meeting scenario. */
  Meeting: 8,
  /** AI server scenario. */
  AiServer: 9,
  /** AI client scenario. */
  AiClient: 10,
} as const;

export type AgoraAudioScenarioValue =
  (typeof AgoraAudioScenario)[keyof typeof AgoraAudioScenario] | number;
