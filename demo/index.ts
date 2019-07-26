import { state } from './core';

import { Projector, InteractionMode } from '../src';

const containerElement = document.getElementById('container')!;
const messagesElement = document.getElementById('messages')!;

const { dataSet } = state;
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
});

const setInteractionMode = (mode: InteractionMode) => () => {
  if (mode === InteractionMode.PAN) projector.setPanMode();
  else if (mode === InteractionMode.SELECT) projector.setSelectMode();
};

document.getElementById('pan-button')!.onclick = setInteractionMode(
  InteractionMode.PAN
);
document.getElementById('select-button')!.onclick = setInteractionMode(
  InteractionMode.SELECT
);
