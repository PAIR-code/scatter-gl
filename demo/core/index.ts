import * as fmnist from '../../data/projection.json';

import { DataPoint, DataSet } from '../../src/data';

class State {
  // Projector-compatible data points wrapper for visualization
  dataSet: DataSet;

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

    this.dataSet = new DataSet(dataPoints, 3);
  }
}

export const state = new State();
