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
