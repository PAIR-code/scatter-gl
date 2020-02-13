/*
@license
Copyright 2019 Google LLC. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {Sequence, Point3D, PointMetadata} from '../src/data';

export function makeSequences(
  points: Point3D[],
  metadata: PointMetadata[],
  nSequencesPerLabel = 3,
  sequenceLength = 5
) {
  const pointIndicesByLabel = new Map<string, number[]>();
  points.forEach((point, index) => {
    const label = metadata[index].label!;
    const pointIndices = pointIndicesByLabel.get(label) || [];
    pointIndices.push(index);
    pointIndicesByLabel.set(label, pointIndices);
  });

  const sequences: Sequence[] = [];

  pointIndicesByLabel.forEach(indices => {
    for (let i = 0; i < nSequencesPerLabel; i++) {
      const sequence: Sequence = {indices: []};
      for (let j = 0; j < sequenceLength; j++) {
        const index = indices[i * sequenceLength + j];
        sequence.indices.push(index);
      }
      sequence.indices.push(sequence.indices[0]);
      sequences.push(sequence);
    }
  });

  return sequences;
}
