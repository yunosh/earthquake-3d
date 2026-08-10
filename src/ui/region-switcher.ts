export class RegionSwitcher {
  private container: HTMLElement;
  private selectElement: HTMLSelectElement;
  private changeCallbacks: Array<(regionId: string) => void> = [];

  constructor(container: HTMLElement, regions: { id: string; title: string }[]) {
    this.container = container;
    this.selectElement = this.render(regions);
    this.attachListeners();
  }

  onChange(callback: (regionId: string) => void): void {
    this.changeCallbacks.push(callback);
  }

  setActive(regionId: string): void {
    this.selectElement.value = regionId;
  }

  setDisabled(disabled: boolean): void {
    this.selectElement.disabled = disabled;
  }

  private render(regions: { id: string; title: string }[]): HTMLSelectElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'region-switcher';

    const label = document.createElement('label');
    label.textContent = 'Region: ';
    label.setAttribute('for', 'region-select');

    const select = document.createElement('select');
    select.id = 'region-select';
    select.setAttribute('aria-label', 'Region auswählen');

    for (const region of regions) {
      const option = document.createElement('option');
      option.value = region.id;
      option.textContent = region.title;
      select.appendChild(option);
    }

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    this.container.appendChild(wrapper);
    return select;
  }

  private attachListeners(): void {
    this.selectElement.addEventListener('change', () => {
      const id = this.selectElement.value;
      for (const cb of this.changeCallbacks) cb(id);
    });
  }
}
