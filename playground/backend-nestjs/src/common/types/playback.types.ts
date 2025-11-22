export interface PlaybackConfig {
  speed: number;
  pauseOnError: boolean;
  skipScreenshots: boolean;
  startFromEvent?: number;
  endAtEvent?: number;
}

export interface PlaybackStatus {
  isPlaying: boolean;
  currentEventIndex: number;
  totalEvents: number;
  elapsedTime: number;
  remainingTime: number;
  speed: number;
}