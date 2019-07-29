/* Copyright 2019 Google LLC. All Rights Reserved.

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

export interface PointMetadata {
  [key: string]: number | string;
}

/** Matches the json format of `projector_config.proto` */
export interface SpriteMetadata {
  spriteImage?: HTMLImageElement;
  singleSpriteSize: [number, number];
}

/** A single collection of points which make up a sequence through space. */
export interface Sequence {
  /** Indices into the DataPoints array in the Data object. */
  pointIndices: number[];
}

export interface DataPoint {
  /** The point in the projected space. */
  vector: Float32Array | number[];

  /** index in the original data source */
  index: number;

  /*
   * Metadata for each point. Each metadata is a set of key/value pairs
   * where the value can be a string or a number.
   */
  metadata?: PointMetadata;

  /** index of the sequence, used for highlighting on click */
  sequenceIndex?: number;
}

export class DataSet {
  public spriteMetadata?: SpriteMetadata;

  constructor(
    public points: DataPoint[],
    public components: number,
    public sequences: Sequence[] = []
  ) {}

  setSpriteMetadata(spriteMetadata: SpriteMetadata) {
    this.spriteMetadata = spriteMetadata;
  }
}
