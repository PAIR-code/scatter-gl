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
import {CameraType, RenderContext} from './render';
import {BoundingBox, CollisionGrid} from './label';
import {Styles} from './styles';
import * as util from './util';

const MAX_LABELS_ON_SCREEN = 10000;

/**
 * Creates and maintains a 2d canvas on top of the GL canvas. All labels, when
 * active, are rendered to the 2d canvas as part of the visible render pass.
 */
export class ScatterPlotVisualizerCanvasLabels
  implements ScatterPlotVisualizer {
  public id = 'CANVAS_LABELS';

  private worldSpacePointPositions = new Float32Array(0);
  private gc: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private labelsActive: boolean = true;

  constructor(container: HTMLElement, private styles: Styles) {
    this.canvas = document.createElement('canvas');
    container.appendChild(this.canvas);

    this.gc = this.canvas.getContext('2d')!;
    this.canvas.style.position = 'absolute';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.className = 'label';
    this.canvas.style.pointerEvents = 'none';
  }

  private removeAllLabels() {
    const pixelWidth = this.canvas.width * window.devicePixelRatio;
    const pixelHeight = this.canvas.height * window.devicePixelRatio;
    this.gc.clearRect(0, 0, pixelWidth, pixelHeight);
  }

  /** Render all of the non-overlapping visible labels to the canvas. */
  private makeLabels(rc: RenderContext) {
    if (rc.labels == null || rc.labels.pointIndices.length === 0) {
      return;
    }
    if (this.worldSpacePointPositions == null) {
      return;
    }

    const lrc = rc.labels;
    const sceneIs3D: boolean = rc.cameraType === CameraType.Perspective;
    const labelHeight = parseInt(this.gc.font, 10);
    const dpr = window.devicePixelRatio;

    let grid: CollisionGrid;
    {
      const pixw = this.canvas.width * dpr;
      const pixh = this.canvas.height * dpr;
      const bb: BoundingBox = {loX: 0, hiX: pixw, loY: 0, hiY: pixh};
      grid = new CollisionGrid(bb, pixw / 25, pixh / 50);
    }

    const cameraDomain = [
      rc.farthestCameraSpacePointZ,
      rc.nearestCameraSpacePointZ,
    ];
    const opacityMap = (x: number) =>
      util.scaleExponential(x, cameraDomain, [0.1, 1]);

    const camPos = rc.camera.position;
    const camToTarget = camPos.clone().sub(rc.cameraTarget);
    let camToPoint = new THREE.Vector3();

    this.gc.textBaseline = 'middle';
    this.gc.miterLimit = 2;

    // Have extra space between neighboring labels. Don't pack too tightly.
    const labelMargin = 2;
    // Shift the label to the right of the point circle.
    const xShift = 4;

    const n = Math.min(MAX_LABELS_ON_SCREEN, lrc.pointIndices.length);
    for (let i = 0; i < n; ++i) {
      let point: THREE.Vector3;
      {
        const pi = lrc.pointIndices[i];
        point = util.vector3FromPackedArray(this.worldSpacePointPositions, pi);
      }

      // discard points that are behind the camera
      camToPoint.copy(camPos).sub(point);
      if (camToTarget.dot(camToPoint) < 0) {
        continue;
      }

      let [x, y] = util.vector3DToScreenCoords(
        rc.camera,
        rc.screenWidth,
        rc.screenHeight,
        point
      );
      x += xShift;

      // Computing the width of the font is expensive,
      // so we assume width of 1 at first. Then, if the label doesn't
      // conflict with other labels, we measure the actual width.
      const textBoundingBox: BoundingBox = {
        loX: x - labelMargin,
        hiX: x + 1 + labelMargin,
        loY: y - labelHeight / 2 - labelMargin,
        hiY: y + labelHeight / 2 + labelMargin,
      };

      if (grid.insert(textBoundingBox, true)) {
        const text = lrc.labelStrings[i];
        const fontSize = lrc.defaultFontSize * lrc.scaleFactors[i] * dpr;
        this.gc.font = fontSize + 'px roboto';

        // Now, check with properly computed width.
        textBoundingBox.hiX += this.gc.measureText(text).width - 1;
        if (grid.insert(textBoundingBox)) {
          let opacity = 1;
          if (sceneIs3D && lrc.useSceneOpacityFlags[i] === 1) {
            opacity = opacityMap(camToPoint.length());
          }
          this.gc.fillStyle = this.styleStringFromPackedRgba(
            lrc.fillColors,
            i,
            opacity
          );
          this.gc.strokeStyle = this.styleStringFromPackedRgba(
            lrc.strokeColors,
            i,
            opacity
          );
          this.gc.lineWidth = this.styles.label.strokeWidth;
          this.gc.strokeText(text, x, y);
          this.gc.lineWidth = this.styles.label.fillWidth;
          this.gc.fillText(text, x, y);
        }
      }
    }
  }

  private styleStringFromPackedRgba(
    packedRgbaArray: Uint8Array,
    colorIndex: number,
    opacity: number
  ): string {
    const offset = colorIndex * 3;
    const r = packedRgbaArray[offset];
    const g = packedRgbaArray[offset + 1];
    const b = packedRgbaArray[offset + 2];
    return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
  }

  onResize(newWidth: number, newHeight: number) {
    let dpr = window.devicePixelRatio;
    this.canvas.width = newWidth * dpr;
    this.canvas.height = newHeight * dpr;
    this.canvas.style.width = newWidth + 'px';
    this.canvas.style.height = newHeight + 'px';
  }

  dispose() {
    this.removeAllLabels();
    // this.canvas = null;
    // this.gc = null;
  }

  onPointPositionsChanged(newPositions: Float32Array) {
    this.worldSpacePointPositions = newPositions;
    this.removeAllLabels();
  }

  onRender(rc: RenderContext) {
    if (!this.labelsActive) {
      return;
    }

    this.removeAllLabels();
    this.makeLabels(rc);
  }

  setScene(scene: THREE.Scene) {}
  onPickingRender(renderContext: RenderContext) {}
}
