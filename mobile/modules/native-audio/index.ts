import { NativeModule, requireNativeModule } from 'expo';

type NativeAudioEvents = {
  onLevel: (params: { level: number; rms: number; db: number; peak: number }) => void;
  onState: (params: { state: 'running' | 'stopped' }) => void;
  onError: (params: { message: string }) => void;
};

declare class NativeAudioModule extends NativeModule<NativeAudioEvents> {
  configure(frameMs: number): void;
  requestPermission(): Promise<boolean>;
  start(): Promise<boolean>;
  stop(): void;
  activatePlaybackSession(): void;
  analyzeFile(uri: string, frameMs: number): Promise<number[]>;
}

export default requireNativeModule<NativeAudioModule>('NativeAudio');
