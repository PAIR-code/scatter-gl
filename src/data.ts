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

/*
 * Metadata for each point. Each metadata is a set of key/value pairs
 * where the value can be a string or a number.
 */
export interface PointMetadata {
  label?: string;
  [key: string]: number | string | undefined;
}

/**
 * Metadata for displaying sprites in the renderer - the renderer expects a
 * sprite sheet with tiled sprites, which it reads left-to-right and
 * top-to-bottom. If `spriteIndices` is specified, each data point will be
 * associated with an index-specified sprite from the sprite sheet.
 */
export interface SpriteMetadata {
  spriteImage?: HTMLImageElement | string;
  singleSpriteSize: [number, number];
  spriteIndices?: number[];
}

/** A single collection of points which make up a sequence through space. */
export interface Sequence {
  /** Indices into the DataPoints array in the Data object. */
  indices: number[];
}

export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type Points = Array<Point2D | Point3D>;

const DIMENSIONALITY_ERROR_MESSAGE =
  'Points must be an array of either 2 or 3 dimensional number arrays';

export class Dataset {
  public spriteMetadata?: SpriteMetadata;
  public dimensions: number;

  /**
   *
   * @param points the data as an array of 2d or 3d number arrays
   * @param metadata an array of point metadata, corresponding to each point
   * @param sequences a collection of points that make up a sequence
   */
  constructor(public points: Points, public metadata: PointMetadata[] = []) {
    const dimensions = points[0].length;
    if (!(dimensions === 2 || dimensions === 3)) {
      throw new Error(DIMENSIONALITY_ERROR_MESSAGE);
    }
    for (const point of points) {
      if (dimensions !== point.length) {
        throw new Error(DIMENSIONALITY_ERROR_MESSAGE);
      }
    }
    this.dimensions = dimensions;
  }

  setSpriteMetadata(spriteMetadata: SpriteMetadata) {
    this.spriteMetadata = spriteMetadata;
  }
}
