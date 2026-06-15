export type DemoCaseSection = 'Basic' | 'Advanced';
export type DemoCaseDisplayMode = 'audio' | 'video';

export type DemoCaseDefinition = {
  name: string;
  section: DemoCaseSection;
  displayMode: DemoCaseDisplayMode;
  actions: readonly string[];
};

export const DEMO_CASE_SECTIONS = [
  { name: 'Basic' },
  { name: 'Advanced' },
] as const;

export const DEMO_CASES = [
  {
    name: 'JoinChannelAudio',
    section: 'Basic',
    displayMode: 'audio',
    actions: [
      'Initialize',
      'JoinChannel',
      'EnableAudio',
      'EnableLocalAudio',
      'MuteLocalAudio',
      'MuteRemoteAudio',
      'MuteAllRemoteAudio',
      'AudioVolumeIndication',
      'Speaker',
      'Leave',
    ],
  },
  {
    name: 'JoinChannelVideo',
    section: 'Basic',
    displayMode: 'video',
    actions: [
      'StartPreview',
      'JoinChannel',
      'JoinLeaveLoop',
      'SwitchCamera',
      'Cam',
      'MuteLocalVideo',
      'MuteAllRemoteVideo',
      'RefreshViews',
      'Leave',
    ],
  },
  {
    name: 'StringUid',
    section: 'Basic',
    displayMode: 'audio',
    actions: [
      'Initialize',
      'JoinWithUserAccount',
      'GetUserInfoByUserAccount',
      'Leave',
    ],
  },
  {
    name: 'AudioEffectMixing',
    section: 'Advanced',
    displayMode: 'audio',
    actions: [
      'JoinChannel',
      'PreloadEffect',
      'PlayEffect',
      'PauseEffect',
      'ResumeEffect',
      'SetEffectsVolume',
      'StartAudioMixing',
      'SetAudioMixingPosition',
      'AudioMixingPublishVolume',
      'AudioMixingPlayoutVolume',
      'AudioMixingVolume',
      'Leave',
    ],
  },
  {
    name: 'SetVideoEncoderConfiguration',
    section: 'Advanced',
    displayMode: 'video',
    actions: ['StartPreview', 'JoinChannel', 'ApplyEncoder', 'Leave'],
  },
  {
    name: 'SetBeautyEffect',
    section: 'Advanced',
    displayMode: 'video',
    actions: ['StartPreview', 'JoinChannel', 'BeautyEffect', 'Leave'],
  },
  {
    name: 'SetContentInspect',
    section: 'Advanced',
    displayMode: 'video',
    actions: ['StartPreview', 'JoinChannel', 'ContentInspect', 'Leave'],
  },
  {
    name: 'ChannelProfile',
    section: 'Advanced',
    displayMode: 'audio',
    actions: ['Profile', 'Role', 'Initialize', 'JoinChannel', 'Leave'],
  },
  {
    name: 'SetParameters',
    section: 'Advanced',
    displayMode: 'audio',
    actions: [
      'KeepAudioSession',
      'MixableAudio',
      'RestartInterrupted',
      'AutoMirror',
      'DebugFlag',
    ],
  },
] as const satisfies readonly DemoCaseDefinition[];

export type DemoCaseName = typeof DEMO_CASES[number]['name'];

export function findDemoCase(name: string): DemoCaseDefinition | null {
  return DEMO_CASES.find((item) => item.name === name) ?? null;
}
