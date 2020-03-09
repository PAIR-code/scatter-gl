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

import * as THREE from 'three';
import {ScatterPlotVisualizer} from './scatter_plot_visualizer';
import {RenderContext} from './render';
import {Dataset, Sequence} from './data';
import * as util from './util';
import {RGBA_NUM_ELEMENTS, XYZ_NUM_ELEMENTS} from './constants';

/**
 * Renders polylines that connect multiple points in the dataset.
 */
export class ScatterPlotVisualizerPolylines implements ScatterPlotVisualizer {
  public id = 'POLYLINES';

  private sequences: Sequence[] = [];
  private scene!: THREE.Scene;
  private polylines: THREE.LineSegments[] = [];
  private polylinePositionBuffer: {
    [polylineIndex: number]: THREE.BufferAttribute;
  } = {};
  private polylineColorBuffer: {
    [polylineIndex: number]: THREE.BufferAttribute;
  } = {};

  private pointSequenceIndices = new Map<number, number>();

  getPointSequenceIndex(pointIndex: number) {
    return this.pointSequenceIndices.get(pointIndex);
  }

  private updateSequenceIndices() {
    for (let i = 0; i < this.sequences.length; i++) {
      const sequence = this.sequences[i];
      for (let j = 0; j < sequence.indices.length - 1; j++) {
        const pointIndex = sequence.indices[j];
        this.pointSequenceIndices.set(pointIndex, i);
        this.pointSequenceIndices.set(pointIndex + 1, i);
      }
    }
  }

  private createPolylines() {
    this.updateSequenceIndices();

    for (const polyline of this.polylines) {
      this.scene.remove(polyline);
      polyline.geometry.dispose();
    }

    this.polylines = [];

    for (let i = 0; i < this.sequences.length; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.addAttribute('position', this.polylinePositionBuffer[i]);
      geometry.addAttribute('color', this.polylineColorBuffer[i]);

      const material = new THREE.LineBasicMaterial({
        linewidth: 1, // unused default, overwritten by width array.
        opacity: 1.0, // unused default, overwritten by opacity array.
        transparent: true,
        vertexColors: THREE.VertexColors,
      });

      const polyline = new THREE.LineSegments(geometry, material);
      polyline.frustumCulled = false;
      this.polylines.push(polyline);
      this.scene.add(polyline);
    }
  }

  dispose() {
    for (const polyline of this.polylines) {
      this.scene.remove(polyline);
      polyline.geometry.dispose();
    }
    this.polylines = [];
    this.polylinePositionBuffer = {};
    this.polylineColorBuffer = {};
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  setSequences(sequences: Sequence[]) {
    this.sequences = sequences;
  }

  onPointPositionsChanged(newPositions: Float32Array) {
    if (newPositions == null) this.dispose();
    if (newPositions == null || this.sequences.length === 0) {
      return;
    }

    // Set up the position buffer arrays for each polyline.
    for (let i = 0; i < this.sequences.length; i++) {
      let sequence = this.sequences[i];
      const vertexCount = 2 * (sequence.indices.length - 1);

      let polylines = new Float32Array(vertexCount * XYZ_NUM_ELEMENTS);
      this.polylinePositionBuffer[i] = new THREE.BufferAttribute(
        polylines,
        XYZ_NUM_ELEMENTS
      );

      let colors = new Float32Array(vertexCount * RGBA_NUM_ELEMENTS);
      this.polylineColorBuffer[i] = new THREE.BufferAttribute(
        colors,
        RGBA_NUM_ELEMENTS
      );
    }
    for (let i = 0; i < this.sequences.length; i++) {
      const sequence = this.sequences[i];
      let src = 0;
      for (let j = 0; j < sequence.indices.length - 1; j++) {
        const p1Index = sequence.indices[j];
        const p2Index = sequence.indices[j + 1];
        const p1 = util.vector3FromPackedArray(newPositions, p1Index);
        const p2 = util.vector3FromPackedArray(newPositions, p2Index);
        this.polylinePositionBuffer[i].setXYZ(src, p1.x, p1.y, p1.z);
        this.polylinePositionBuffer[i].setXYZ(src + 1, p2.x, p2.y, p2.z);
        src += 2;
      }
      this.polylinePositionBuffer[i].needsUpdate = true;
    }

    this.createPolylines();
  }

  onRender(renderContext: RenderContext) {
    for (let i = 0; i < this.polylines.length; i++) {
      const material = this.polylines[i].material as THREE.LineBasicMaterial;
      material.opacity = renderContext.polylineOpacities[i];
      material.linewidth = renderContext.polylineWidths[i];
      this.polylineColorBuffer[i].array = renderContext.polylineColors[i];
      this.polylineColorBuffer[i].needsUpdate = true;
    }
  }

  onPickingRender(renderContext: RenderContext) {}
  onResize(newWidth: number, newHeight: number) {}
}
