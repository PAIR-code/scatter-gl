import { state } from './core';

import { Projector } from '../src/projector';

const containerElement = document.getElementById('container')!;

const projector = new Projector({
  containerElement,
  onHover: (point: number | null) => {
    console.log('🔥hover', point);
  },
  onSelect: (points: number[]) => {
    console.log('🔥select', points);
  },
});

const { projection } = state;
projector.updateScatterPlotWithNewProjection(projection);
