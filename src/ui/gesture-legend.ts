/**
 * Small, non-interactive legend explaining the available mouse/touch
 * gestures for controlling the 3D camera (OrbitControls).
 */

interface GestureEntry {
  gesture: string;
  action: string;
}

const GESTURES: GestureEntry[] = [
  { gesture: 'Drag (left) / 1 finger', action: 'Rotate' },
  { gesture: 'Drag (right/middle) / 2 fingers', action: 'Pan' },
  { gesture: 'Scroll / pinch', action: 'Zoom' },
];

export class GestureLegend {
  constructor(container: HTMLElement) {
    this.render(container);
  }

  private render(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'gesture-legend';

    const title = document.createElement('div');
    title.className = 'gesture-legend-title';
    title.textContent = 'Controls';
    wrapper.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'gesture-legend-list';

    for (const entry of GESTURES) {
      const item = document.createElement('li');

      const gestureEl = document.createElement('span');
      gestureEl.className = 'gesture-legend-gesture';
      gestureEl.textContent = entry.gesture;

      const actionEl = document.createElement('span');
      actionEl.className = 'gesture-legend-action';
      actionEl.textContent = entry.action;

      item.appendChild(gestureEl);
      item.appendChild(actionEl);
      list.appendChild(item);
    }

    wrapper.appendChild(list);
    container.appendChild(wrapper);
  }
}
