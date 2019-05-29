import { state } from './core';
import { ProjectorScatterPlotAdapter } from '../src';
import { dummyProjectorEventContext } from '../src/projector-event-context';

const containerElement = document.getElementById('container')!;

const scatterPlotAdapter = new ProjectorScatterPlotAdapter(
  containerElement,
  dummyProjectorEventContext
);

const { projection } = state;
scatterPlotAdapter.updateScatterPlotWithNewProjection(projection);
