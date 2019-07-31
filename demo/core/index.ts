import * as fmnist from '../../data/projection.json';

import { DataPoint, Dataset } from '../../src/data';

class State {
  // Projector-compatible data points wrapper for visualization
  dataset: Dataset;

  constructor() {
    const dataPoints: DataPoint[] = fmnist.projection.map(
      (vector: number[], index) => {
        const labelIndex = fmnist.labels[index];
        return {
          vector,
          metadata: {
            labelIndex,
            label: fmnist.label_names[labelIndex],
          },
          index,
        };
      }
    );

    this.dataset = new Dataset(dataPoints, 3);
  }
}

export const state = new State();
