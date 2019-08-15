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

/*
 * Metadata for each point. Each metadata is a set of key/value pairs
 * where the value can be a string or a number.
 */
export interface PointMetadata {
  label?: string;
  [key: string]: number | string | undefined;
}

/** Matches the json format of `projector_config.proto` */
export interface SpriteMetadata {
  spriteImage?: HTMLImageElement | string;
  singleSpriteSize: [number, number];
}

/** A single collection of points which make up a sequence through space. */
export interface Sequence {
  /** Indices into the DataPoints array in the Data object. */
  pointIndices: number[];
}

export type Points = number[][];

export class Dataset {
  public spriteMetadata?: SpriteMetadata;

  /**
   *
   * @param points the data as an array of number or Float32 arrays
   * @param dimensions the number of dimensions
   * @param metadata an array of point metadata, corresponding to each point
   * @param sequences a collection of points that make up a sequence
   */
  constructor(
    public points: Points,
    public dimensions: number,
    public metadata: PointMetadata[] = [],
    public sequences: Sequence[] = []
  ) {}

  setSpriteMetadata(spriteMetadata: SpriteMetadata) {
    this.spriteMetadata = spriteMetadata;
  }
}
