/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

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
import { ScatterPlot } from './scatter-plot';
import { Projection } from './data';
import { LabelRenderParams } from './render';
import * as util from './util';

import { ScatterPlotVisualizer3DLabels } from './scatter-plot-visualizer-3d-labels';
import { ScatterPlotVisualizerSprites } from './scatter-plot-visualizer-sprites';
import { ScatterPlotVisualizerCanvasLabels } from './scatter-plot-visualizer-canvas-labels';
import { ScatterPlotVisualizerPolylines } from './scatter-plot-visualizer-polylines';

const LABEL_FONT_SIZE = 10;
const LABEL_SCALE_DEFAULT = 1.0;
const LABEL_SCALE_LARGE = 2;
const LABEL_FILL_COLOR_SELECTED = 0x000000;
const LABEL_FILL_COLOR_HOVER = 0x000000;
const LABEL_STROKE_COLOR_SELECTED = 0xffffff;
const LABEL_STROKE_COLOR_HOVER = 0xffffff;

const POINT_COLOR_UNSELECTED = 0xe3e3e3;
const POINT_COLOR_NO_SELECTION = 0x7575d9;
const POINT_COLOR_SELECTED = 0xfa6666;
const POINT_COLOR_HOVER = 0x760b4f;

const POINT_SCALE_DEFAULT = 1.0;
const POINT_SCALE_SELECTED = 1.2;
const POINT_SCALE_HOVER = 1.2;

const LABELS_3D_COLOR_UNSELECTED = 0xffffff;
const LABELS_3D_COLOR_NO_SELECTION = 0xffffff;

const SPRITE_IMAGE_COLOR_UNSELECTED = 0xffffff;
const SPRITE_IMAGE_COLOR_NO_SELECTION = 0xffffff;

const SCATTER_PLOT_CUBE_LENGTH = 2;

export interface ProjectorParams {
  containerElement: HTMLElement;
  onHover?: (point: number | null) => void;
  onSelect?: (points: number[]) => void;
}

/**
 * Interprets projector events and assembles the arrays and commands necessary
 * to use the ScatterPlot to render the current projected data set.
 */
export class Projector {
  public scatterPlot: ScatterPlot;
  private projection: Projection;
  private containerElement: HTMLElement;

  private renderLabelsIn3D = false;
  private legendPointColorer: (index: number) => string;

  private spriteVisualizer: ScatterPlotVisualizerSprites;
  private labels3DVisualizer: ScatterPlotVisualizer3DLabels;
  private canvasLabelsVisualizer: ScatterPlotVisualizerCanvasLabels;
  private polylineVisualizer: ScatterPlotVisualizerPolylines;

  private hoverPointIndex: number;
  private selectedPointIndices: number[];

  constructor(private params: ProjectorParams) {
    const { containerElement } = this.params;
    this.containerElement = containerElement;
    this.scatterPlot = new ScatterPlot(containerElement, this);
    this.createVisualizers();
  }

  onSelect(selection: number[]) {
    if (this.params.onSelect) this.params.onSelect(selection);
  }

  onHover(point: number | null) {
    if (this.params.onHover) this.params.onHover(point);
  }

  set3DLabelMode(renderLabelsIn3D: boolean) {
    this.renderLabelsIn3D = renderLabelsIn3D;
    this.createVisualizers();
    this.updateScatterPlotAttributes();
    this.scatterPlot.render();
  }

  setLegendPointColorer(legendPointColorer: (index: number) => string) {
    this.legendPointColorer = legendPointColorer;
  }

  setProjection(projection: Projection) {
    this.projection = projection;
    if (this.polylineVisualizer != null) {
      this.polylineVisualizer.setProjection(projection);
    }
    if (this.labels3DVisualizer != null) {
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());
    }
    if (this.spriteVisualizer == null) {
      return;
    }
    this.spriteVisualizer.clearSpriteAtlas();

    if (projection == null || projection.spriteAndMetadataInfo == null) {
      return;
    }
    const metadata = projection.spriteAndMetadataInfo;
    if (metadata.spriteImage == null || metadata.spriteMetadata == null) {
      return;
    }
    const n = projection.points.length;
    const spriteIndices = new Float32Array(n);
    for (let i = 0; i < n; ++i) {
      spriteIndices[i] = projection.points[i].index;
    }

    this.spriteVisualizer.setSpriteAtlas(
      metadata.spriteImage,
      metadata.spriteMetadata.singleImageDim,
      spriteIndices
    );
  }

  resize() {
    this.scatterPlot.resize();
  }

  updateScatterPlotPositions() {
    const newPositions = this.generatePointPositionArray();
    this.scatterPlot.setPointPositions(newPositions);
  }

  updateScatterPlotAttributes() {
    if (this.projection == null) {
      return;
    }
    const selectedSet = this.selectedPointIndices;
    const hoverIndex = this.hoverPointIndex;

    const pointColorer = this.legendPointColorer;

    const pointColors = this.generatePointColorArray(
      pointColorer,
      selectedSet,
      hoverIndex
    );
    const pointScaleFactors = this.generatePointScaleFactorArray(
      selectedSet,
      hoverIndex
    );
    const labels = this.generateVisibleLabelRenderParams(
      selectedSet,
      hoverIndex
    );
    // const polylineColors = this.generateLineSegmentColorMap(pointColorer);
    // const polylineOpacities = this.generateLineSegmentOpacityArray(selectedSet);
    // const polylineWidths = this.generateLineSegmentWidthArray(selectedSet);

    this.scatterPlot.setPointColors(pointColors);
    this.scatterPlot.setPointScaleFactors(pointScaleFactors);
    this.scatterPlot.setLabels(labels);
    // this.scatterPlot.setPolylineColors(polylineColors);
    // this.scatterPlot.setPolylineOpacities(polylineOpacities);
    // this.scatterPlot.setPolylineWidths(polylineWidths);
  }

  render() {
    this.scatterPlot.render();
  }

  generatePointPositionArray(): Float32Array {
    const { projection } = this;
    if (projection == null) return new Float32Array([]);

    let xExtent = [0, 0];
    let yExtent = [0, 0];
    let zExtent = [0, 0];

    // Determine max and min of each axis of our data.
    xExtent = util.extent(projection.points.map(p => p.vector[0]));
    yExtent = util.extent(projection.points.map(p => p.vector[1]));

    const range = [-SCATTER_PLOT_CUBE_LENGTH / 2, SCATTER_PLOT_CUBE_LENGTH / 2];

    if (projection.components === 3) {
      zExtent = util.extent(projection.points.map(p => p.vector[0]));
    }

    const positions = new Float32Array(projection.points.length * 3);
    let dst = 0;

    projection.points.forEach((d, i) => {
      const vector = projection.points[i].vector;

      positions[dst++] = util.scaleLinear(vector[0], xExtent, range);
      positions[dst++] = util.scaleLinear(vector[1], yExtent, range);

      if (projection.components === 3) {
        positions[dst++] = util.scaleLinear(vector[2], zExtent, range);
      } else {
        positions[dst++] = 0.0;
      }
    });
    return positions;
  }

  generateVisibleLabelRenderParams(
    selectedPointIndices: number[],
    hoverPointIndex: number
  ): LabelRenderParams {
    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;
    const n = selectedPointCount + (hoverPointIndex != null ? 1 : 0);

    const visibleLabels = new Uint32Array(n);
    const scale = new Float32Array(n);
    const opacityFlags = new Int8Array(n);
    const fillColors = new Uint8Array(n * 3);
    const strokeColors = new Uint8Array(n * 3);
    const labelStrings: string[] = [];

    scale.fill(LABEL_SCALE_DEFAULT);
    opacityFlags.fill(1);

    let dst = 0;

    if (hoverPointIndex != null) {
      labelStrings.push(this.getLabelText(hoverPointIndex));
      visibleLabels[dst] = hoverPointIndex;
      scale[dst] = LABEL_SCALE_LARGE;
      opacityFlags[dst] = 0;
      const fillRgb = util.styleRgbFromHexColor(LABEL_FILL_COLOR_HOVER);
      util.packRgbIntoUint8Array(
        fillColors,
        dst,
        fillRgb[0],
        fillRgb[1],
        fillRgb[2]
      );
      const strokeRgb = util.styleRgbFromHexColor(LABEL_STROKE_COLOR_HOVER);
      util.packRgbIntoUint8Array(
        strokeColors,
        dst,
        strokeRgb[0],
        strokeRgb[1],
        strokeRgb[1]
      );
      ++dst;
    }

    // Selected points
    {
      const n = selectedPointCount;
      const fillRgb = util.styleRgbFromHexColor(LABEL_FILL_COLOR_SELECTED);
      const strokeRgb = util.styleRgbFromHexColor(LABEL_STROKE_COLOR_SELECTED);
      for (let i = 0; i < n; ++i) {
        const labelIndex = selectedPointIndices[i];
        labelStrings.push(this.getLabelText(labelIndex));
        visibleLabels[dst] = labelIndex;
        scale[dst] = LABEL_SCALE_LARGE;
        opacityFlags[dst] = n === 1 ? 0 : 1;
        util.packRgbIntoUint8Array(
          fillColors,
          dst,
          fillRgb[0],
          fillRgb[1],
          fillRgb[2]
        );
        util.packRgbIntoUint8Array(
          strokeColors,
          dst,
          strokeRgb[0],
          strokeRgb[1],
          strokeRgb[2]
        );
        ++dst;
      }
    }

    return new LabelRenderParams(
      new Float32Array(visibleLabels),
      labelStrings,
      scale,
      opacityFlags,
      LABEL_FONT_SIZE,
      fillColors,
      strokeColors
    );
  }

  generatePointScaleFactorArray(
    selectedPointIndices: number[],
    hoverPointIndex: number
  ): Float32Array {
    const projection = this.projection;
    if (projection == null) {
      return new Float32Array(0);
    }

    const scale = new Float32Array(projection.points.length);
    scale.fill(POINT_SCALE_DEFAULT);

    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;

    // Scale up all selected points.
    {
      const n = selectedPointCount;
      for (let i = 0; i < n; ++i) {
        const p = selectedPointIndices[i];
        scale[p] = POINT_SCALE_SELECTED;
      }
    }

    // Scale up the hover point.
    if (hoverPointIndex != null) {
      scale[hoverPointIndex] = POINT_SCALE_HOVER;
    }

    return scale;
  }

  generatePointColorArray(
    legendPointColorer: (index: number) => string,
    selectedPointIndices: number[],
    hoverPointIndex: number,
    label3dMode = false,
    spriteImageMode = false
  ): Float32Array {
    const projection = this.projection;
    if (projection == null) {
      return new Float32Array(0);
    }

    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;

    const colors = new Float32Array(projection.points.length * 3);

    let unselectedColor = POINT_COLOR_UNSELECTED;
    let noSelectionColor = POINT_COLOR_NO_SELECTION;

    if (label3dMode) {
      unselectedColor = LABELS_3D_COLOR_UNSELECTED;
      noSelectionColor = LABELS_3D_COLOR_NO_SELECTION;
    }

    if (spriteImageMode) {
      unselectedColor = SPRITE_IMAGE_COLOR_UNSELECTED;
      noSelectionColor = SPRITE_IMAGE_COLOR_NO_SELECTION;
    }

    // Give all points the unselected color.
    {
      const n = projection.points.length;
      let dst = 0;
      if (selectedPointCount > 0) {
        const c = new THREE.Color(unselectedColor);
        for (let i = 0; i < n; ++i) {
          colors[dst++] = c.r;
          colors[dst++] = c.g;
          colors[dst++] = c.b;
        }
      } else {
        if (legendPointColorer != null) {
          for (let i = 0; i < n; ++i) {
            const c = new THREE.Color(legendPointColorer(i) || undefined);
            colors[dst++] = c.r;
            colors[dst++] = c.g;
            colors[dst++] = c.b;
          }
        } else {
          const c = new THREE.Color(noSelectionColor);
          for (let i = 0; i < n; ++i) {
            colors[dst++] = c.r;
            colors[dst++] = c.g;
            colors[dst++] = c.b;
          }
        }
      }
    }

    // Color the selected points.
    {
      const n = selectedPointCount;
      const c = new THREE.Color(POINT_COLOR_SELECTED);
      for (let i = 0; i < n; ++i) {
        let dst = selectedPointIndices[i] * 3;
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
      }
    }

    // Color the hover point.
    if (hoverPointIndex != null) {
      const c = new THREE.Color(POINT_COLOR_HOVER);
      let dst = hoverPointIndex * 3;
      colors[dst++] = c.r;
      colors[dst++] = c.g;
      colors[dst++] = c.b;
    }

    return colors;
  }

  generate3DLabelsArray() {
    const { projection } = this;
    if (projection == null) {
      return [];
    }
    let labels: string[] = [];
    const n = projection.points.length;
    for (let i = 0; i < n; ++i) {
      labels.push(this.getLabelText(i));
    }
    return labels;
  }

  private getLabelText(i: number) {
    const { projection } = this;
    return projection.points[i].metadata.label.toString();
  }

  updateScatterPlotWithNewProjection(
    projection: Projection,
    canBeRendered = true
  ) {
    if (projection == null) {
      this.createVisualizers();
      this.scatterPlot.render();
      return;
    }
    this.setProjection(projection);
    this.scatterPlot.setDimensions(projection.components);
    if (canBeRendered) {
      this.updateScatterPlotAttributes();
      this.updateScatterPlotPositions();
      this.scatterPlot.render();
    }
    this.scatterPlot.setCameraParametersForNextCameraCreation(null, false);
  }

  private createVisualizers() {
    const scatterPlot = this.scatterPlot;
    scatterPlot.removeAllVisualizers();

    if (this.renderLabelsIn3D) {
      this.labels3DVisualizer = new ScatterPlotVisualizer3DLabels();
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());

      scatterPlot.addVisualizer(this.labels3DVisualizer);
    } else {
      this.spriteVisualizer = new ScatterPlotVisualizerSprites();
      scatterPlot.addVisualizer(this.spriteVisualizer);
      this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(
        this.containerElement
      );
    }
  }

  private getSpriteImageMode(): boolean {
    const { projection } = this;
    if (projection == null) {
      return false;
    }
    if (projection == null || projection.spriteAndMetadataInfo == null) {
      return false;
    }
    return projection.spriteAndMetadataInfo.spriteImage != null;
  }
}
