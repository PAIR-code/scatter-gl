import { state } from './core';

import { ScatterGL, RenderMode, InteractionMode } from '../src';

const containerElement = document.getElementById('container')!;
const messagesElement = document.getElementById('messages')!;

const { dataset } = state;

dataset.setSpriteMetadata({
  spriteImage: 'spritesheet.png',
  singleSpriteSize: [28, 28],
});

let lastSelectedPoints: number[] = [];

const projector = new ScatterGL({
  containerElement,
  onHover: (point: number | null) => {
    const message = `🔥hover ${point}`;
    console.log(message);
    messagesElement.innerHTML = message;
  },
  onSelect: (points: number[]) => {
    let message = '';
    if (points.length === 0 && lastSelectedPoints.length === 0) {
      message = '🔥 no selection';
    } else if (points.length === 0 && lastSelectedPoints.length > 0) {
      message = '🔥 deselected';
    } else if (points.length === 1) {
      message = `🔥 selected ${points}`;
    } else {
      message = `🔥selected ${points.length} points`;
    }
    console.log(message);
    messagesElement.innerHTML = message;
  },
  dataset,
  renderMode: RenderMode.POINT,
});

document
  .querySelectorAll<HTMLInputElement>('input[name="interactions"]')
  .forEach(inputElement => {
    inputElement.addEventListener('change', () => {
      if (inputElement.value === 'pan') {
        projector.setPanMode();
      } else if (inputElement.value === 'select') {
        projector.setSelectMode();
      }
    });
  });

document
  .querySelectorAll<HTMLInputElement>('input[name="render"]')
  .forEach(inputElement => {
    inputElement.addEventListener('change', () => {
      if (inputElement.value === 'points') {
        projector.setPointRenderMode();
      } else if (inputElement.value === 'sprites') {
        projector.setSpriteRenderMode();
      } else if (inputElement.value === 'text') {
        projector.setTextRenderMode();
      }
    });
  });

const colorsByLabel = [...new Array(10)].map((_, i) => {
  const hue = Math.floor((255 / 10) * i);
  return `hsl(${hue}, 100%, 50%)`;
});

document
  .querySelectorAll<HTMLInputElement>('input[name="color"]')
  .forEach(inputElement => {
    inputElement.addEventListener('change', () => {
      if (inputElement.value === 'default') {
        projector.setPointColorer(null);
      } else if (inputElement.value === 'label') {
        projector.setPointColorer(i => {
          const labelIndex = dataset.metadata![i].labelIndex as number;
          return colorsByLabel[labelIndex];
        });
      }
    });
  });
