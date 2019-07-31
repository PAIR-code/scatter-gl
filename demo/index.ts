import { state } from './core';

import { Projector, InteractionMode } from '../src';
import { RenderMode } from '../src/projector';

const containerElement = document.getElementById('container')!;
const messagesElement = document.getElementById('messages')!;

const { dataSet } = state;

dataSet.setSpriteMetadata({
  spriteImage: 'spritesheet.png',
  singleSpriteSize: [28, 28],
});

const projector = new Projector({
  containerElement,
  onHover: (point: number | null) => {
    const message = `🔥hover ${point}`;
    console.log(message);
    messagesElement.innerHTML = message;
  },
  onSelect: (points: number[]) => {
    const message = `🔥select ${points}`;
    console.log(message);
    messagesElement.innerHTML = message;
  },
  dataSet,
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

// document.getElementById('pan-button')!.onclick = setInteractionMode(
//   InteractionMode.PAN
// );
// document.getElementById('select-button')!.onclick = setInteractionMode(
//   InteractionMode.SELECT
// );
