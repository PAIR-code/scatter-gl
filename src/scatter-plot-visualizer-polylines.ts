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

import * as THREE from 'three';
import { ScatterPlotVisualizer } from './scatter-plot-visualizer';
import { RenderContext } from './render';
import { Dataset } from './data';
import * as util from './util';
import { RGB_NUM_ELEMENTS, XYZ_NUM_ELEMENTS } from './constants';

/**
 * Renders polylines that connect multiple points in the dataset.
 */
export class ScatterPlotVisualizerPolylines implements ScatterPlotVisualizer {
  private dataset: Dataset;
  private scene: THREE.Scene;
  private polylines: THREE.Line[];
  private polylinePositionBuffer: {
    [polylineIndex: number]: THREE.BufferAttribute;
  } = {};
  private polylineColorBuffer: {
    [polylineIndex: number]: THREE.BufferAttribute;
  } = {};

  private updateSequenceIndicesInDataset(dataset: Dataset) {
    for (let i = 0; i < dataset.sequences.length; i++) {
      const sequence = dataset.sequences[i];
      for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
        // TODO (andycoenen): Refactor the polylines sequenceIndex system
        // dataset.points[sequence.pointIndices[j]].sequenceIndex = i;
        // dataset.points[sequence.pointIndices[j + 1]].sequenceIndex = i;
      }
    }
  }

  private createPolylines(scene: THREE.Scene) {
    if (!this.dataset || !this.dataset.sequences) {
      return;
    }

    this.updateSequenceIndicesInDataset(this.dataset);
    this.polylines = [];

    for (let i = 0; i < this.dataset.sequences.length; i++) {
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
      scene.add(polyline);
    }
  }

  dispose() {
    if (this.polylines.length == null) {
      return;
    }
    for (let i = 0; i < this.polylines.length; i++) {
      this.scene.remove(this.polylines[i]);
      this.polylines[i].geometry.dispose();
    }
    this.polylines = [];
    this.polylinePositionBuffer = {};
    this.polylineColorBuffer = {};
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  setDataset(dataset: Dataset) {
    this.dataset = dataset;
  }

  onPointPositionsChanged(newPositions: Float32Array) {
    if (newPositions == null || this.polylines != null) {
      this.dispose();
    }
    if (newPositions == null || this.dataset == null) {
      return;
    }
    // Set up the position buffer arrays for each polyline.
    for (let i = 0; i < this.dataset.sequences.length; i++) {
      let sequence = this.dataset.sequences[i];
      const vertexCount = 2 * (sequence.pointIndices.length - 1);

      let polylines = new Float32Array(vertexCount * XYZ_NUM_ELEMENTS);
      this.polylinePositionBuffer[i] = new THREE.BufferAttribute(
        polylines,
        XYZ_NUM_ELEMENTS
      );

      let colors = new Float32Array(vertexCount * RGB_NUM_ELEMENTS);
      this.polylineColorBuffer[i] = new THREE.BufferAttribute(
        colors,
        RGB_NUM_ELEMENTS
      );
    }
    for (let i = 0; i < this.dataset.sequences.length; i++) {
      const sequence = this.dataset.sequences[i];
      let src = 0;
      for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
        const p1Index = sequence.pointIndices[j];
        const p2Index = sequence.pointIndices[j + 1];
        const p1 = util.vector3FromPackedArray(newPositions, p1Index);
        const p2 = util.vector3FromPackedArray(newPositions, p2Index);
        this.polylinePositionBuffer[i].setXYZ(src, p1.x, p1.y, p1.z);
        this.polylinePositionBuffer[i].setXYZ(src + 1, p2.x, p2.y, p2.z);
        src += 2;
      }
      this.polylinePositionBuffer[i].needsUpdate = true;
    }

    if (this.polylines == null) {
      this.createPolylines(this.scene);
    }
  }

  onRender(renderContext: RenderContext) {
    if (this.polylines == null) {
      return;
    }
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
