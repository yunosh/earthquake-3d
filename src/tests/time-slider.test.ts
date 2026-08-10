import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeSlider, type TimeSliderConfig } from '../ui/time-slider';

function makeConfig(overrides?: Partial<TimeSliderConfig>): TimeSliderConfig {
  return {
    container: document.createElement('div'),
    minDate: new Date('2000-01-01T00:00:00Z'),
    maxDate: new Date('2024-06-15T00:00:00Z'),
    defaultRange: 7,
    ...overrides,
  };
}

describe('TimeSlider', () => {
  let container: HTMLDivElement;
  let slider: TimeSlider;

  beforeEach(() => {
    container = document.createElement('div');
    slider = new TimeSlider(makeConfig({ container }));
  });

  describe('rendering', () => {
    it('renders date range inputs', () => {
      const inputs = container.querySelectorAll('input[type="date"]');
      expect(inputs.length).toBe(2);
    });

    it('sets correct min/max on date inputs', () => {
      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      expect(inputs[0].min).toBe('2000-01-01');
      expect(inputs[0].max).toBe('2024-06-15');
      expect(inputs[1].min).toBe('2000-01-01');
      expect(inputs[1].max).toBe('2024-06-15');
    });

    it('sets default start date to 7 days before maxDate', () => {
      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      expect(inputs[0].value).toBe('2024-06-08');
      expect(inputs[1].value).toBe('2024-06-15');
    });

    it('renders speed selector with correct options', () => {
      const select = container.querySelector('select');
      expect(select).not.toBeNull();
      const options = select!.querySelectorAll('option');
      expect(options.length).toBe(6);
      expect(options[0].value).toBe('0.25');
      expect(options[0].textContent).toBe('0.25x');
      expect(options[1].value).toBe('0.5');
      expect(options[2].value).toBe('1');
      expect(options[3].value).toBe('2');
      expect(options[4].value).toBe('4');
      expect(options[5].value).toBe('8');
    });

    it('default speed is 1x', () => {
      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('1');
    });

    it('renders play/pause button', () => {
      const btn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Play');
    });

    it('renders reset button', () => {
      const btn = container.querySelector('.reset-btn') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe('Reset');
    });

    it('renders progress bar', () => {
      const progress = container.querySelector('progress') as HTMLProgressElement;
      expect(progress).not.toBeNull();
      expect(progress.max).toBe(1);
      expect(progress.value).toBe(0);
    });

    it('renders virtual time display', () => {
      const span = container.querySelector('.virtual-time') as HTMLSpanElement;
      expect(span).not.toBeNull();
      expect(span.textContent).toBe('--');
    });

    it('renders message area', () => {
      const msgArea = container.querySelector('.time-slider-messages');
      expect(msgArea).not.toBeNull();
    });
  });

  describe('onRangeChange callback', () => {
    it('fires when start date changes', () => {
      const cb = vi.fn();
      slider.onRangeChange(cb);

      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      inputs[0].value = '2024-06-01';
      inputs[0].dispatchEvent(new Event('change'));

      expect(cb).toHaveBeenCalledTimes(1);
      const [start, end] = cb.mock.calls[0];
      expect(start.toISOString()).toContain('2024-06-01');
      expect(end.toISOString()).toContain('2024-06-15');
    });

    it('fires when end date changes', () => {
      const cb = vi.fn();
      slider.onRangeChange(cb);

      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      inputs[1].value = '2024-06-10';
      inputs[1].dispatchEvent(new Event('change'));

      expect(cb).toHaveBeenCalledTimes(1);
      const [start, end] = cb.mock.calls[0];
      expect(start.toISOString()).toContain('2024-06-08');
      expect(end.toISOString()).toContain('2024-06-10');
    });

    it('does not fire if start >= end', () => {
      const cb = vi.fn();
      slider.onRangeChange(cb);

      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      inputs[0].value = '2024-06-20'; // after end
      inputs[0].dispatchEvent(new Event('change'));

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('onSpeedChange callback', () => {
    it('fires with selected multiplier when speed changes', () => {
      const cb = vi.fn();
      slider.onSpeedChange(cb);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = '4';
      select.dispatchEvent(new Event('change'));

      expect(cb).toHaveBeenCalledWith(4);
    });
  });

  describe('onPlayPause callback', () => {
    it('fires with true on first click (play)', () => {
      const cb = vi.fn();
      slider.onPlayPause(cb);

      const btn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      btn.click();

      expect(cb).toHaveBeenCalledWith(true);
    });

    it('toggles button text to Pause when playing', () => {
      const btn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      btn.click();
      expect(btn.textContent).toBe('Pause');
    });

    it('fires with false on second click (pause)', () => {
      const cb = vi.fn();
      slider.onPlayPause(cb);

      const btn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      btn.click(); // play
      btn.click(); // pause

      expect(cb).toHaveBeenCalledTimes(2);
      expect(cb).toHaveBeenLastCalledWith(false);
    });

    it('toggles button text back to Play when paused', () => {
      const btn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      btn.click(); // play
      btn.click(); // pause
      expect(btn.textContent).toBe('Play');
    });
  });

  describe('onReset callback', () => {
    it('fires when reset is clicked', () => {
      const cb = vi.fn();
      slider.onReset(cb);

      const btn = container.querySelector('.reset-btn') as HTMLButtonElement;
      btn.click();

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('resets play button text to Play on reset', () => {
      const playBtn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      playBtn.click(); // start playing
      expect(playBtn.textContent).toBe('Pause');

      const resetBtn = container.querySelector('.reset-btn') as HTMLButtonElement;
      resetBtn.click();
      expect(playBtn.textContent).toBe('Play');
    });
  });

  describe('setProgress', () => {
    it('updates progress bar value', () => {
      slider.setProgress(0.5);
      const progress = container.querySelector('progress') as HTMLProgressElement;
      expect(progress.value).toBe(0.5);
    });

    it('clamps progress to 0', () => {
      slider.setProgress(-0.5);
      const progress = container.querySelector('progress') as HTMLProgressElement;
      expect(progress.value).toBe(0);
    });

    it('clamps progress to 1', () => {
      slider.setProgress(1.5);
      const progress = container.querySelector('progress') as HTMLProgressElement;
      expect(progress.value).toBe(1);
    });
  });

  describe('setVirtualTime', () => {
    it('displays formatted date/time', () => {
      const time = new Date('2024-03-15T14:30:00Z');
      slider.setVirtualTime(time);

      const span = container.querySelector('.virtual-time') as HTMLSpanElement;
      expect(span.textContent).toContain('2024-03-15');
      expect(span.textContent).toContain('14:30:00');
      expect(span.textContent).toContain('UTC');
    });
  });

  describe('setLoading', () => {
    it('disables controls when loading', () => {
      slider.setLoading(true);

      const playBtn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      const resetBtn = container.querySelector('.reset-btn') as HTMLButtonElement;
      const select = container.querySelector('select') as HTMLSelectElement;
      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');

      expect(playBtn.disabled).toBe(true);
      expect(resetBtn.disabled).toBe(true);
      expect(select.disabled).toBe(true);
      expect(inputs[0].disabled).toBe(true);
      expect(inputs[1].disabled).toBe(true);
    });

    it('enables controls when not loading', () => {
      slider.setLoading(true);
      slider.setLoading(false);

      const playBtn = container.querySelector('.play-pause-btn') as HTMLButtonElement;
      const resetBtn = container.querySelector('.reset-btn') as HTMLButtonElement;
      const select = container.querySelector('select') as HTMLSelectElement;

      expect(playBtn.disabled).toBe(false);
      expect(resetBtn.disabled).toBe(false);
      expect(select.disabled).toBe(false);
    });

    it('adds loading class when loading', () => {
      slider.setLoading(true);
      const wrapper = container.querySelector('.time-slider-controls') as HTMLDivElement;
      expect(wrapper.classList.contains('loading')).toBe(true);
    });
  });

  describe('showError', () => {
    it('displays error message', () => {
      slider.showError('Connection failed');
      const msg = container.querySelector('.time-slider-message--error');
      expect(msg).not.toBeNull();
      expect(msg!.textContent).toBe('Connection failed');
    });

    it('sets role to alert for accessibility', () => {
      slider.showError('Error occurred');
      const msg = container.querySelector('.time-slider-message--error');
      expect(msg!.getAttribute('role')).toBe('alert');
    });
  });

  describe('showWarning', () => {
    it('displays warning message', () => {
      slider.showWarning('Some records skipped');
      const msg = container.querySelector('.time-slider-message--warning');
      expect(msg).not.toBeNull();
      expect(msg!.textContent).toBe('Some records skipped');
    });

    it('sets role to status', () => {
      slider.showWarning('Warning text');
      const msg = container.querySelector('.time-slider-message--warning');
      expect(msg!.getAttribute('role')).toBe('status');
    });
  });

  describe('showInfo', () => {
    it('displays info message', () => {
      slider.showInfo('No events found');
      const msg = container.querySelector('.time-slider-message--info');
      expect(msg).not.toBeNull();
      expect(msg!.textContent).toBe('No events found');
    });

    it('replaces previous message', () => {
      slider.showError('Error');
      slider.showInfo('Info');
      const errors = container.querySelectorAll('.time-slider-message--error');
      const infos = container.querySelectorAll('.time-slider-message--info');
      expect(errors.length).toBe(0);
      expect(infos.length).toBe(1);
    });
  });

  describe('multiple callbacks', () => {
    it('supports multiple onRangeChange callbacks', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      slider.onRangeChange(cb1);
      slider.onRangeChange(cb2);

      const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
      inputs[0].value = '2024-06-01';
      inputs[0].dispatchEvent(new Event('change'));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('supports multiple onSpeedChange callbacks', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      slider.onSpeedChange(cb1);
      slider.onSpeedChange(cb2);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = '2';
      select.dispatchEvent(new Event('change'));

      expect(cb1).toHaveBeenCalledWith(2);
      expect(cb2).toHaveBeenCalledWith(2);
    });
  });
});
