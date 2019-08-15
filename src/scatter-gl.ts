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
import { ScatterPlot } from './scatter-plot';
import { Dataset, SpriteMetadata } from './data';
import { LabelRenderParams } from './render';
import { Styles, UserStyles, makeStyles } from './styles';
import { InteractionMode, RenderMode } from './types';
import * as util from './util';
import { SCATTER_PLOT_CUBE_LENGTH } from './constants';

import { ScatterPlotVisualizer } from './scatter-plot-visualizer';
import { ScatterPlotVisualizer3DLabels } from './scatter-plot-visualizer-3d-labels';
import { ScatterPlotVisualizerSprites } from './scatter-plot-visualizer-sprites';
import { ScatterPlotVisualizerCanvasLabels } from './scatter-plot-visualizer-canvas-labels';
import { ScatterPlotVisualizerPolylines } from './scatter-plot-visualizer-polylines';

export type PointColorer = (index: number) => string;

export interface ScatterGLParams {
  containerElement: HTMLElement;
  dataset: Dataset;
  onHover?: (point: number | null) => void;
  onSelect?: (points: number[]) => void;
  pointColorer?: PointColorer;
  renderMode?: RenderMode;
  showLabelsOnHover?: boolean;
  styles?: UserStyles;
  rotateOnStart?: boolean;
}

/**
 * ScatterGL - An interactive, webGL-accelerate 2D/3D scatter plot renderer.
 */
export class ScatterGL {
  private containerElement: HTMLElement;
  private dataset: Dataset;
  private styles: Styles;
  private renderMode = RenderMode.SPRITE;
  private showLabelsOnHover = true;
  private rotateOnStart = true;

  private scatterPlot: ScatterPlot;

  private pointColorer: PointColorer | null;

  private labels3DVisualizer: ScatterPlotVisualizer3DLabels;
  private canvasLabelsVisualizer: ScatterPlotVisualizerCanvasLabels;
  private pointVisualizer: ScatterPlotVisualizerSprites;
  private polylineVisualizer: ScatterPlotVisualizerPolylines;
  private spritesheetVisualizer: ScatterPlotVisualizerSprites;

  private hoverPointIndex: number | null = null;
  private selectedPointIndices: number[] = [];

  private hoverCallback: (point: number | null) => void = () => {};
  private selectCallback: (points: number[]) => void = () => {};

  private setParameter(
    params: ScatterGLParams,
    key: keyof ScatterGLParams,
    targetKey: string = key
  ) {
    if (params[key] !== undefined) {
      (this as any)[targetKey] = params[key];
    }
  }

  constructor(params: ScatterGLParams) {
    this.containerElement = params.containerElement;
    this.styles = makeStyles(params.styles);

    // Instantiate params if they exist
    this.setParameter(params, 'renderMode');
    this.setParameter(params, 'showLabelsOnHover');
    this.setParameter(params, 'onHover', 'hoverCallback');
    this.setParameter(params, 'onSelect', 'selectCallback');
    this.setParameter(params, 'pointColorer');
    this.setParameter(params, 'rotateOnStart');

    this.scatterPlot = new ScatterPlot({
      containerElement: this.containerElement,
      onHover: this.onHover,
      onSelect: this.onSelect,
      styles: this.styles,
      dimensions: params.dataset.dimensions,
    });

    this.setVisualizers();
    this.updateDataset(params.dataset);

    if (this.rotateOnStart) {
      this.scatterPlot.startOrbitAnimation();
    }
  }

  setRenderMode(renderMode: RenderMode) {
    this.renderMode = renderMode;
    this.setVisualizers();
    this.updateScatterPlotAttributes();
    this.updateScatterPlotPositions();
  }

  setTextRenderMode() {
    this.setRenderMode(RenderMode.TEXT);
    this.scatterPlot.render();
  }

  setPointRenderMode() {
    this.setRenderMode(RenderMode.POINT);
    this.scatterPlot.render();
  }

  setSpriteRenderMode() {
    if (this.dataset.spriteMetadata) {
      this.setRenderMode(RenderMode.SPRITE);
      this.scatterPlot.render();
    }
  }

  setPanMode() {
    this.scatterPlot.setInteractionMode(InteractionMode.PAN);
  }

  setSelectMode() {
    this.scatterPlot.setInteractionMode(InteractionMode.SELECT);
  }

  setDimensions(nDimensions: number) {
    const outsideRange = nDimensions < 2 || nDimensions > 3;
    const moreThanDataset = nDimensions > this.dataset.dimensions;
    if (outsideRange || moreThanDataset) {
      throw new RangeError('Setting invalid dimensionality');
    } else {
      this.scatterPlot.setDimensions(nDimensions);
      this.scatterPlot.render();
    }
  }

  setPointColorer(pointColorer: PointColorer | null) {
    this.pointColorer = pointColorer;
    this.updateScatterPlotAttributes();
    this.scatterPlot.render();
  }

  resize() {
    this.scatterPlot.resize();
  }

  render() {
    this.scatterPlot.render();
  }

  onHover = (pointIndex: number | null) => {
    this.hoverCallback(pointIndex);
    this.hoverPointIndex = pointIndex;
    this.updateScatterPlotAttributes();
    this.scatterPlot.render();
  };

  onSelect = (pointIndices: number[]) => {
    this.selectCallback(pointIndices);
    this.selectedPointIndices = pointIndices;
    this.updateScatterPlotAttributes();
    this.scatterPlot.render();
  };

  updateDataset(dataset: Dataset) {
    this.setDataset(dataset);
    this.scatterPlot.setDimensions(dataset.dimensions);
    this.updateScatterPlotAttributes();
    this.updateScatterPlotPositions();
    this.scatterPlot.render();
  }

  startOrbitAnimation() {
    this.scatterPlot.startOrbitAnimation();
  }

  private setDataset(dataset: Dataset) {
    this.dataset = dataset;

    if (this.polylineVisualizer) {
      this.polylineVisualizer.setDataset(dataset);
    }

    if (this.labels3DVisualizer) {
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());
    }

    if (this.pointVisualizer) {
      // this.pointVisualizer.clearSpriteSheet();
      // if (dataset.spriteMetadata && this.renderMode === RenderMode.SPRITE) {
      //   this.initializeSpriteSheet(dataset.spriteMetadata);
      // }
    }
  }

  private updateScatterPlotPositions() {
    const newPositions = this.generatePointPositionArray();
    this.scatterPlot.setPointPositions(newPositions);
  }

  private updateScatterPlotAttributes() {
    const pointColors = this.generatePointColorArray();
    const pointScaleFactors = this.generatePointScaleFactorArray();
    const labels = this.generateVisibleLabelRenderParams();
    const polylineColors = this.generateLineSegmentColorMap();
    const polylineOpacities = this.generateLineSegmentOpacityArray();
    const polylineWidths = this.generateLineSegmentWidthArray();

    this.scatterPlot.setPointColors(pointColors);
    this.scatterPlot.setPointScaleFactors(pointScaleFactors);
    this.scatterPlot.setLabels(labels);
    this.scatterPlot.setPolylineColors(polylineColors);
    this.scatterPlot.setPolylineOpacities(polylineOpacities);
    this.scatterPlot.setPolylineWidths(polylineWidths);
  }

  private generatePointPositionArray(): Float32Array {
    const { dataset } = this;

    let xExtent = [0, 0];
    let yExtent = [0, 0];
    let zExtent = [0, 0];

    // Determine max and min of each axis of our data.
    xExtent = util.extent(dataset.points.map(p => p[0]));
    yExtent = util.extent(dataset.points.map(p => p[1]));

    if (dataset.dimensions === 3) {
      zExtent = util.extent(dataset.points.map(p => p[2]));
    }

    const range = [-SCATTER_PLOT_CUBE_LENGTH / 2, SCATTER_PLOT_CUBE_LENGTH / 2];
    const positions = new Float32Array(dataset.points.length * 3);
    let dst = 0;

    dataset.points.forEach((d, i) => {
      const vector = dataset.points[i];

      positions[dst++] = util.scaleLinear(vector[0], xExtent, range);
      positions[dst++] = util.scaleLinear(vector[1], yExtent, range);

      if (dataset.dimensions === 3) {
        positions[dst++] = util.scaleLinear(vector[2], zExtent, range);
      } else {
        positions[dst++] = 0.0;
      }
    });
    return positions;
  }

  private generateVisibleLabelRenderParams(): LabelRenderParams {
    const { hoverPointIndex, selectedPointIndices, styles } = this;
    const selectedPointCount = selectedPointIndices.length;
    const n = selectedPointCount + (hoverPointIndex !== null ? 1 : 0);

    const visibleLabels = new Uint32Array(n);
    const scale = new Float32Array(n);
    const opacityFlags = new Int8Array(n);
    const fillColors = new Uint8Array(n * 3);
    const strokeColors = new Uint8Array(n * 3);
    const labelStrings: string[] = [];

    scale.fill(styles.label.scaleDefault);
    opacityFlags.fill(1);

    let dst = 0;

    if (hoverPointIndex !== null) {
      labelStrings.push(this.getLabelText(hoverPointIndex));
      visibleLabels[dst] = hoverPointIndex;
      scale[dst] = styles.label.scaleLarge;
      opacityFlags[dst] = 0;
      const fillRgb = util.styleRgbFromHexColor(styles.label.fillColorHover);
      util.packRgbIntoUint8Array(
        fillColors,
        dst,
        fillRgb[0],
        fillRgb[1],
        fillRgb[2]
      );
      const strokeRgb = util.styleRgbFromHexColor(
        styles.label.strokeColorHover
      );
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
      const fillRgb = util.styleRgbFromHexColor(styles.label.fillColorSelected);
      const strokeRgb = util.styleRgbFromHexColor(
        styles.label.strokeColorSelected
      );
      for (let i = 0; i < n; ++i) {
        const labelIndex = selectedPointIndices[i];
        labelStrings.push(this.getLabelText(labelIndex));
        visibleLabels[dst] = labelIndex;
        scale[dst] = styles.label.scaleLarge;
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
      styles.label.fontSize,
      fillColors,
      strokeColors
    );
  }

  private generatePointScaleFactorArray(): Float32Array {
    const { dataset, hoverPointIndex, selectedPointIndices, styles } = this;
    const { scaleDefault, scaleSelected, scaleHover } = styles.point;

    const scale = new Float32Array(dataset.points.length);
    scale.fill(scaleDefault);

    const selectedPointCount = selectedPointIndices.length;

    // Scale up all selected points.
    {
      const n = selectedPointCount;
      for (let i = 0; i < n; ++i) {
        const p = selectedPointIndices[i];
        scale[p] = scaleSelected;
      }
    }

    // Scale up the hover point.
    if (hoverPointIndex != null) {
      scale[hoverPointIndex] = scaleHover;
    }

    return scale;
  }

  private generatePointColorArray(): Float32Array {
    const {
      dataset,
      hoverPointIndex,
      pointColorer,
      selectedPointIndices,
      styles,
    } = this;

    const {
      colorHover,
      colorNoSelection,
      colorSelected,
      colorUnselected,
    } = styles.point;

    const selectedPointCount = selectedPointIndices.length;

    const colors = new Float32Array(dataset.points.length * 3);

    let unselectedColor = colorUnselected;
    let noSelectionColor = colorNoSelection;

    if (this.renderMode === RenderMode.TEXT) {
      unselectedColor = this.styles.label3D.colorUnselected;
      noSelectionColor = this.styles.label3D.colorNoSelection;
    }

    if (this.renderMode === RenderMode.SPRITE) {
      unselectedColor = this.styles.sprites.colorUnselected;
      noSelectionColor = this.styles.sprites.colorNoSelection;
    }

    // Give all points the unselected color.
    {
      const n = dataset.points.length;
      let dst = 0;
      if (selectedPointCount > 0) {
        const c = new THREE.Color(unselectedColor);
        for (let i = 0; i < n; ++i) {
          colors[dst++] = c.r;
          colors[dst++] = c.g;
          colors[dst++] = c.b;
        }
      } else {
        if (pointColorer) {
          for (let i = 0; i < n; ++i) {
            const c = new THREE.Color(pointColorer(i) || noSelectionColor);
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
      const c = new THREE.Color(colorSelected);
      for (let i = 0; i < n; ++i) {
        let dst = selectedPointIndices[i] * 3;
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
      }
    }

    // Color the hover point.
    if (hoverPointIndex != null) {
      const c = new THREE.Color(colorHover);
      let dst = hoverPointIndex * 3;
      colors[dst++] = c.r;
      colors[dst++] = c.g;
      colors[dst++] = c.b;
    }

    return colors;
  }

  private generate3DLabelsArray() {
    const { dataset } = this;
    let labels: string[] = [];
    const n = dataset.points.length;
    for (let i = 0; i < n; ++i) {
      labels.push(this.getLabelText(i));
    }
    return labels;
  }

  private generateLineSegmentColorMap(): {
    [polylineIndex: number]: Float32Array;
  } {
    const { dataset, pointColorer, styles } = this;
    const polylineColorArrayMap: { [polylineIndex: number]: Float32Array } = {};

    for (let i = 0; i < dataset.sequences.length; i++) {
      let sequence = dataset.sequences[i];
      let colors = new Float32Array(2 * (sequence.pointIndices.length - 1) * 3);
      let colorIndex = 0;

      if (pointColorer) {
        for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
          const c1 = new THREE.Color(pointColorer(sequence.pointIndices[j]));
          const c2 = new THREE.Color(
            pointColorer(sequence.pointIndices[j + 1])
          );
          colors[colorIndex++] = c1.r;
          colors[colorIndex++] = c1.g;
          colors[colorIndex++] = c1.b;
          colors[colorIndex++] = c2.r;
          colors[colorIndex++] = c2.g;
          colors[colorIndex++] = c2.b;
        }
      } else {
        for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
          const c1 = util.getDefaultPointInPolylineColor(
            j,
            sequence.pointIndices.length,
            styles.polyline.startHue,
            styles.polyline.endHue,
            styles.polyline.saturation,
            styles.polyline.lightness
          );
          const c2 = util.getDefaultPointInPolylineColor(
            j + 1,
            sequence.pointIndices.length,
            styles.polyline.startHue,
            styles.polyline.endHue,
            styles.polyline.saturation,
            styles.polyline.lightness
          );
          colors[colorIndex++] = c1.r;
          colors[colorIndex++] = c1.g;
          colors[colorIndex++] = c1.b;
          colors[colorIndex++] = c2.r;
          colors[colorIndex++] = c2.g;
          colors[colorIndex++] = c2.b;
        }
      }

      polylineColorArrayMap[i] = colors;
    }

    return polylineColorArrayMap;
  }

  private generateLineSegmentOpacityArray(): Float32Array {
    const { dataset, selectedPointIndices, styles } = this;

    const opacities = new Float32Array(dataset.sequences.length);
    const selectedPointCount = selectedPointIndices.length;
    if (selectedPointCount > 0) {
      opacities.fill(styles.polyline.deselectedOpacity);
      // TODO (andycoenen): Refactor the polylines sequenceIndex system
      // const i = dataset.points[selectedPointIndices[0]].sequenceIndex;
      // if (i !== undefined) opacities[i] = styles.polyline.selectedOpacity;
    } else {
      opacities.fill(styles.polyline.defaultOpacity);
    }
    return opacities;
  }

  private generateLineSegmentWidthArray(): Float32Array {
    const { dataset, selectedPointIndices, styles } = this;

    const widths = new Float32Array(dataset.sequences.length);
    widths.fill(styles.polyline.defaultLineWidth);
    const selectedPointCount = selectedPointIndices.length;
    if (selectedPointCount > 0) {
      // TODO (andycoenen): Refactor the polylines sequenceIndex system
      // const i = dataset.points[selectedPointIndices[0]].sequenceIndex;
      // if (i !== undefined) widths[i] = styles.polyline.selectedLineWidth;
    }
    return widths;
  }

  private getLabelText(i: number) {
    const { dataset } = this;
    const metadata = dataset.metadata[i];
    return metadata && metadata.label != null ? `${metadata.label}` : '';
  }

  private initializeSpritesheetVisualizer(spriteMetadata: SpriteMetadata) {
    const { dataset, styles } = this;
    if (!spriteMetadata.spriteImage || !spriteMetadata.singleSpriteSize) {
      return;
    }

    const n = dataset.points.length;
    const spriteIndices = new Float32Array(n);
    for (let i = 0; i < n; ++i) {
      spriteIndices[i] = i;
    }

    const onImageLoad = () => this.render();

    const spritesheetVisualizer = new ScatterPlotVisualizerSprites(styles, {
      spritesheetImage: spriteMetadata.spriteImage,
      spriteDimensions: spriteMetadata.singleSpriteSize,
      spriteIndices,
      onImageLoad,
    });
    this.spritesheetVisualizer = spritesheetVisualizer;
  }

  private setVisualizers() {
    const { dataset, renderMode, scatterPlot, styles } = this;
    scatterPlot.disposeAllVisualizers();

    const activeVisualizers: ScatterPlotVisualizer[] = [];
    if (renderMode === RenderMode.TEXT) {
      if (!this.labels3DVisualizer) {
        this.labels3DVisualizer = new ScatterPlotVisualizer3DLabels(styles);
      }
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());
      activeVisualizers.push(this.labels3DVisualizer);
    } else if (renderMode === RenderMode.POINT) {
      if (!this.pointVisualizer) {
        this.pointVisualizer = new ScatterPlotVisualizerSprites(styles);
      }
      activeVisualizers.push(this.pointVisualizer);
    } else if (renderMode === RenderMode.SPRITE && dataset.spriteMetadata) {
      if (!this.spritesheetVisualizer) {
        this.initializeSpritesheetVisualizer(dataset.spriteMetadata);
      }
      if (this.spritesheetVisualizer) {
        activeVisualizers.push(this.spritesheetVisualizer);
      }
    }

    const textLabelsRenderMode =
      renderMode === RenderMode.POINT || renderMode === RenderMode.SPRITE;
    if (textLabelsRenderMode && this.showLabelsOnHover) {
      if (!this.canvasLabelsVisualizer) {
        this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(
          this.containerElement,
          this.styles
        );
      }
      activeVisualizers.push(this.canvasLabelsVisualizer);
    }

    this.scatterPlot.setActiveVisualizers(activeVisualizers);
  }
}
