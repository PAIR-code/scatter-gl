import { state } from './core';

import { Projector } from '../src/projector';

const containerElement = document.getElementById('container')!;

const scatterPlotAdapter = new Projector({
  containerElement,
  onHover: (point: number) => {
    console.log('🔥hover', point);
  },
  onSelect: (points: number[]) => {
    console.log('🔥select', points);
  },
});

const { projection } = state;
scatterPlotAdapter.updateScatterPlotWithNewProjection(projection);
