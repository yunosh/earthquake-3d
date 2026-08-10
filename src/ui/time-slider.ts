/**
 * TimeSlider UI component for controlling earthquake animation playback.
 * Provides date range selection, speed control, playback buttons,
 * progress bar, virtual time display, and message area.
 */

export interface TimeSliderConfig {
  container: HTMLElement;
  minDate: Date;       // 2000-01-01
  maxDate: Date;       // today
  defaultRange: number; // 7 days
}

type MessageType = 'error' | 'warning' | 'info';

export class TimeSlider {
  private container: HTMLElement;
  private minDate: Date;
  private maxDate: Date;

  // DOM elements
  private startInput!: HTMLInputElement;
  private endInput!: HTMLInputElement;
  private speedSelect!: HTMLSelectElement;
  private playPauseBtn!: HTMLButtonElement;
  private resetBtn!: HTMLButtonElement;
  private progressBar!: HTMLProgressElement;
  private timeDisplay!: HTMLSpanElement;
  private messageArea!: HTMLDivElement;
  private controlsWrapper!: HTMLDivElement;

  // State
  private playing = false;

  // Callbacks
  private rangeChangeCallbacks: Array<(start: Date, end: Date) => void> = [];
  private speedChangeCallbacks: Array<(multiplier: number) => void> = [];
  private playPauseCallbacks: Array<(playing: boolean) => void> = [];
  private resetCallbacks: Array<() => void> = [];

  constructor(config: TimeSliderConfig) {
    this.container = config.container;
    this.minDate = config.minDate;
    this.maxDate = config.maxDate;

    this.render(config.defaultRange);
    this.attachEventListeners();
  }

  // --- Public API: Register callbacks ---

  onRangeChange(callback: (start: Date, end: Date) => void): void {
    this.rangeChangeCallbacks.push(callback);
  }

  onSpeedChange(callback: (multiplier: number) => void): void {
    this.speedChangeCallbacks.push(callback);
  }

  onPlayPause(callback: (playing: boolean) => void): void {
    this.playPauseCallbacks.push(callback);
  }

  onReset(callback: () => void): void {
    this.resetCallbacks.push(callback);
  }

  // --- Public API: State setters ---

  setProgress(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.progressBar.value = clamped;
  }

  setVirtualTime(time: Date): void {
    this.timeDisplay.textContent = formatDateTime(time);
  }

  setLoading(loading: boolean): void {
    this.controlsWrapper.classList.toggle('loading', loading);
    this.playPauseBtn.disabled = loading;
    this.resetBtn.disabled = loading;
    this.startInput.disabled = loading;
    this.endInput.disabled = loading;
    this.speedSelect.disabled = loading;
  }

  /** Externally set the play/pause state (e.g., when animation ends) */
  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.playPauseBtn.textContent = playing ? 'Pause' : 'Play';
    this.playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  showError(message: string): void {
    this.showMessage(message, 'error');
  }

  showWarning(message: string): void {
    this.showMessage(message, 'warning');
  }

  showInfo(message: string): void {
    this.showMessage(message, 'info');
  }

  // --- Internal: Rendering ---

  private render(defaultRangeDays: number): void {
    this.controlsWrapper = document.createElement('div');
    this.controlsWrapper.className = 'time-slider-controls';

    // Date range section
    const dateSection = document.createElement('div');
    dateSection.className = 'time-slider-dates';

    const startLabel = document.createElement('label');
    startLabel.textContent = 'Start: ';
    this.startInput = document.createElement('input');
    this.startInput.type = 'date';
    this.startInput.min = toDateString(this.minDate);
    this.startInput.max = toDateString(this.maxDate);
    const defaultStart = new Date(this.maxDate.getTime() - defaultRangeDays * 24 * 60 * 60 * 1000);
    this.startInput.value = toDateString(defaultStart);
    startLabel.appendChild(this.startInput);

    const endLabel = document.createElement('label');
    endLabel.textContent = 'End: ';
    this.endInput = document.createElement('input');
    this.endInput.type = 'date';
    this.endInput.min = toDateString(this.minDate);
    this.endInput.max = toDateString(this.maxDate);
    this.endInput.value = toDateString(this.maxDate);
    endLabel.appendChild(this.endInput);

    dateSection.appendChild(startLabel);
    dateSection.appendChild(endLabel);

    // Speed selector section
    const speedSection = document.createElement('div');
    speedSection.className = 'time-slider-speed';

    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Speed: ';
    this.speedSelect = document.createElement('select');
    const speeds = [0.25, 0.5, 1, 2, 4, 8];
    for (const speed of speeds) {
      const option = document.createElement('option');
      option.value = String(speed);
      option.textContent = `${speed}x`;
      this.speedSelect.appendChild(option);
    }
    this.speedSelect.value = '1';
    speedLabel.appendChild(this.speedSelect);
    speedSection.appendChild(speedLabel);

    // Playback buttons
    const playbackSection = document.createElement('div');
    playbackSection.className = 'time-slider-playback';

    this.playPauseBtn = document.createElement('button');
    this.playPauseBtn.className = 'play-pause-btn';
    this.playPauseBtn.textContent = 'Play';
    this.playPauseBtn.setAttribute('aria-label', 'Play');

    this.resetBtn = document.createElement('button');
    this.resetBtn.className = 'reset-btn';
    this.resetBtn.textContent = 'Reset';
    this.resetBtn.setAttribute('aria-label', 'Reset');

    playbackSection.appendChild(this.playPauseBtn);
    playbackSection.appendChild(this.resetBtn);

    // Progress bar
    const progressSection = document.createElement('div');
    progressSection.className = 'time-slider-progress';

    this.progressBar = document.createElement('progress');
    this.progressBar.max = 1;
    this.progressBar.value = 0;
    progressSection.appendChild(this.progressBar);

    // Virtual time display
    const timeSection = document.createElement('div');
    timeSection.className = 'time-slider-time-display';

    this.timeDisplay = document.createElement('span');
    this.timeDisplay.className = 'virtual-time';
    this.timeDisplay.textContent = '--';
    timeSection.appendChild(this.timeDisplay);

    // Message area
    this.messageArea = document.createElement('div');
    this.messageArea.className = 'time-slider-messages';

    // Assemble
    this.controlsWrapper.appendChild(dateSection);
    this.controlsWrapper.appendChild(speedSection);
    this.controlsWrapper.appendChild(playbackSection);
    this.controlsWrapper.appendChild(progressSection);
    this.controlsWrapper.appendChild(timeSection);
    this.controlsWrapper.appendChild(this.messageArea);

    this.container.appendChild(this.controlsWrapper);
  }

  private attachEventListeners(): void {
    // Date range change
    this.startInput.addEventListener('change', () => this.emitRangeChange());
    this.endInput.addEventListener('change', () => this.emitRangeChange());

    // Speed change
    this.speedSelect.addEventListener('change', () => {
      const multiplier = parseFloat(this.speedSelect.value);
      for (const cb of this.speedChangeCallbacks) {
        cb(multiplier);
      }
    });

    // Play/Pause toggle
    this.playPauseBtn.addEventListener('click', () => {
      this.playing = !this.playing;
      this.playPauseBtn.textContent = this.playing ? 'Pause' : 'Play';
      this.playPauseBtn.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
      for (const cb of this.playPauseCallbacks) {
        cb(this.playing);
      }
    });

    // Reset
    this.resetBtn.addEventListener('click', () => {
      this.playing = false;
      this.playPauseBtn.textContent = 'Play';
      this.playPauseBtn.setAttribute('aria-label', 'Play');
      for (const cb of this.resetCallbacks) {
        cb();
      }
    });
  }

  private emitRangeChange(): void {
    const start = parseDateInput(this.startInput.value);
    const end = parseDateInput(this.endInput.value);
    if (start && end && start < end) {
      for (const cb of this.rangeChangeCallbacks) {
        cb(start, end);
      }
    }
  }

  private showMessage(message: string, type: MessageType): void {
    this.messageArea.textContent = '';
    const msgEl = document.createElement('div');
    msgEl.className = `time-slider-message time-slider-message--${type}`;
    msgEl.setAttribute('role', type === 'error' ? 'alert' : 'status');
    msgEl.textContent = message;
    this.messageArea.appendChild(msgEl);
  }
}

// --- Utility functions ---

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value + 'T00:00:00Z');
  if (isNaN(date.getTime())) return null;
  return date;
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
