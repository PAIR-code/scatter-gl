import * as fmnist from '../../data/projection.json';

import { DataPoint, DataSet } from '../../src/data';

class State {
  // Projector-compatible data points wrapper for visualization
  dataSet: DataSet;

  constructor() {
    const dataPoints: DataPoint[] = fmnist.projection.map(
      (vector: number[], index) => {
        const label = fmnist.labels[index];
        return {
          vector,
          metadata: {
            label: fmnist.label_names[label],
          },
          index,
        };
      }
    );

    this.dataSet = new DataSet(dataPoints, 3);
  }
}

export const state = new State();
