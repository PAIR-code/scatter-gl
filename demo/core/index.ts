import * as fmnist from '../../data/projection.json';

import { Points, Dataset, PointMetadata } from '../../src/data';

class State {
  // Projector-compatible data points wrapper for visualization
  dataset: Dataset;

  constructor() {
    const dataPoints: Points = [];
    const metadata: PointMetadata[] = [];
    fmnist.projection.forEach((vector: number[], index) => {
      const labelIndex = fmnist.labels[index];
      dataPoints.push(vector);
      metadata.push({
        labelIndex,
        label: fmnist.label_names[labelIndex],
      });
    });

    this.dataset = new Dataset(dataPoints, 3, metadata);
  }
}

export const state = new State();
