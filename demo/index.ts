import { state } from './core';

import { Projector, InteractionMode } from '../src';

const containerElement = document.getElementById('container')!;

const { projection } = state;
const projector = new Projector({
  containerElement,
  onHover: (point: number | null) => {
    console.log('🔥hover', point);
  },
  onSelect: (points: number[]) => {
    console.log('🔥select', points);
  },
  projection,
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
