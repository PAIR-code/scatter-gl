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

import {
  ScatterPlot,
  CameraParams,
  OnCameraMoveListener,
  OrbitControlParams,
} from './scatter_plot';
import {parseColor} from './color';
import {Dataset, Sequence} from './data';
import {LabelRenderParams} from './render';
import {Styles, UserStyles, makeStyles} from './styles';
import {InteractionMode, Optional, RenderMode} from './types';
import * as util from './util';
import {SCATTER_PLOT_CUBE_LENGTH, RGBA_NUM_ELEMENTS} from './constants';

import {ScatterPlotVisualizer} from './scatter_plot_visualizer';
import {ScatterPlotVisualizer3DLabels} from './scatter_plot_visualizer_3d_labels';
import {ScatterPlotVisualizerSprites} from './scatter_plot_visualizer_sprites';
import {ScatterPlotVisualizerCanvasLabels} from './scatter_plot_visualizer_canvas_labels';
import {ScatterPlotVisualizerPolylines} from './scatter_plot_visualizer_polylines';

export type PointColorer = (
  index: number,
  selectedIndices: Set<number>,
  hoverIndex: number | null
) => string;

export interface ScatterGLParams {
  camera?: CameraParams;
  onHover?: (point: number | null) => void;
  onClick?: (points: number | null) => void;
  onSelect?: (points: number[]) => void;
  onCameraMove?: OnCameraMoveListener;
  pointColorer?: PointColorer;
  renderMode?: RenderMode;
  rotateOnStart?: boolean;
  selectEnabled?: boolean;
  showLabelsOnHover?: boolean;
  styles?: UserStyles;
  orbitControls?: Optional<OrbitControlParams>;
}

/**
 * ScatterGL - An interactive, webGL-accelerate 2D/3D scatter plot renderer.
 */
export class ScatterGL {
  private containerElement: HTMLElement;
  private dataset?: Dataset;
  private pointColorer: PointColorer | null = null;
  private scatterPlot: ScatterPlot;
  private sequences: Sequence[] = [];
  private styles: Styles;

  private renderMode = RenderMode.POINT;
  private rotateOnStart = true;
  private selectEnabled = true;
  private showLabelsOnHover = true;

  /* Visualizers, maintained by ScatterGL but used by ScatterPlot */
  private canvasLabelsVisualizer?: ScatterPlotVisualizerCanvasLabels;
  private labels3DVisualizer?: ScatterPlotVisualizer3DLabels;
  private pointVisualizer?: ScatterPlotVisualizerSprites;
  private polylineVisualizer?: ScatterPlotVisualizerPolylines;
  private spritesheetVisualizer?: ScatterPlotVisualizerSprites;

  private hoverPointIndex: number | null = null;
  private selectedPointIndices = new Set<number>();

  private clickCallback: (point: number | null) => void = () => {};
  private hoverCallback: (point: number | null) => void = () => {};
  private selectCallback: (points: number[]) => void = () => {};
  private cameraMoveCallback: OnCameraMoveListener = () => {};

  constructor(containerElement: HTMLElement, params: ScatterGLParams = {}) {
    this.containerElement = containerElement;
    this.styles = makeStyles(params.styles);

    // Instantiate params if they exist
    this.setParameters(params);

    this.scatterPlot = new ScatterPlot(containerElement, {
      camera: params.camera,
      onClick: this.onClick,
      onHover: this.onHover,
      onSelect: this.onSelect,
      selectEnabled: this.selectEnabled,
      styles: this.styles,
      orbitControlParams: params.orbitControls,
    });

    this.scatterPlot.onCameraMove(this.cameraMoveCallback);
  }

  private setParameters(p: ScatterGLParams) {
    if (p.onClick !== undefined) this.clickCallback = p.onClick;
    if (p.onHover !== undefined) this.hoverCallback = p.onHover;
    if (p.onSelect !== undefined) this.selectCallback = p.onSelect;
    if (p.onCameraMove !== undefined) this.cameraMoveCallback = p.onCameraMove;
    if (p.pointColorer !== undefined) this.pointColorer = p.pointColorer;
    if (p.renderMode !== undefined) this.renderMode = p.renderMode;
    if (p.rotateOnStart !== undefined) this.rotateOnStart = p.rotateOnStart;
    if (p.selectEnabled !== undefined) this.selectEnabled = p.selectEnabled;
    if (p.showLabelsOnHover !== undefined)
      this.showLabelsOnHover = p.showLabelsOnHover;
  }

  render(dataset: Dataset) {
    this.updateDataset(dataset);
    this.setVisualizers();

    if (this.rotateOnStart) {
      this.scatterPlot.startOrbitAnimation();
    }
  }

  private renderScatterPlot() {
    if (this.dataset) this.scatterPlot.render();
  }

  setRenderMode(renderMode: RenderMode) {
    this.renderMode = renderMode;
    this.setVisualizers();
    this.updateScatterPlotAttributes();
    this.updateScatterPlotPositions();
  }

  setTextRenderMode() {
    this.setRenderMode(RenderMode.TEXT);
    this.renderScatterPlot();
  }

  setPointRenderMode() {
    this.setRenderMode(RenderMode.POINT);
    this.renderScatterPlot();
  }

  setSpriteRenderMode() {
    if (this.dataset && this.dataset.spriteMetadata) {
      this.setRenderMode(RenderMode.SPRITE);
      this.renderScatterPlot();
    }
  }

  setSequences(sequences: Sequence[]) {
    this.sequences = sequences;
    this.updatePolylineAttributes();
    this.setVisualizers();
    this.renderScatterPlot();
  }

  setPanMode() {
    this.scatterPlot.setInteractionMode(InteractionMode.PAN);
  }

  setSelectMode() {
    this.scatterPlot.setInteractionMode(InteractionMode.SELECT);
  }

  setDimensions(nDimensions: number) {
    const outsideRange = nDimensions < 2 || nDimensions > 3;
    const moreThanDataset =
      this.dataset && nDimensions > this.dataset.dimensions;
    if (outsideRange || moreThanDataset) {
      throw new RangeError('Setting invalid dimensionality');
    } else {
      this.scatterPlot.setDimensions(nDimensions);
      this.renderScatterPlot();
    }
  }

  setPointColorer(pointColorer: PointColorer | null) {
    this.pointColorer = pointColorer;
    this.updateScatterPlotAttributes();
    this.renderScatterPlot();
  }

  private callPointColorer(pointColorer: PointColorer, index: number) {
    return pointColorer(index, this.selectedPointIndices, this.hoverPointIndex);
  }

  setHoverPointIndex(index: number) {
    this.hoverPointIndex = index;
    this.updateScatterPlotAttributes();
    /* Skip render if currently animating */
    if (this.scatterPlot.orbitIsAnimating()) return;
    this.renderScatterPlot();
  }

  resize() {
    this.scatterPlot.resize();
  }

  private onHover = (pointIndex: number | null) => {
    this.hoverCallback(pointIndex);
    this.hoverPointIndex = pointIndex;
    this.updateScatterPlotAttributes();
    this.renderScatterPlot();
  };

  private onClick = (pointIndex: number | null) => {
    this.clickCallback(pointIndex);
  };

  select = (pointIndices: number[]) => {
    if (!this.selectEnabled) return;
    this.selectedPointIndices = new Set(pointIndices);
    this.updateScatterPlotAttributes();
    this.renderScatterPlot();
  };

  private onSelect = (pointIndices: number[]) => {
    if (!this.selectEnabled) return;
    this.selectCallback(pointIndices);
    this.select(pointIndices);
  };

  updateDataset(dataset: Dataset) {
    this.setDataset(dataset);
    this.scatterPlot.setDimensions(dataset.dimensions);
    this.updateScatterPlotAttributes();
    this.updateScatterPlotPositions();
    this.renderScatterPlot();
  }

  isOrbiting() {
    return this.scatterPlot.orbitIsAnimating();
  }

  startOrbitAnimation() {
    this.scatterPlot.startOrbitAnimation();
  }

  stopOrbitAnimation() {
    this.scatterPlot.stopOrbitAnimation();
  }

  private setDataset(dataset: Dataset) {
    this.dataset = dataset;

    if (this.labels3DVisualizer) {
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());
    }
  }

  private updateScatterPlotPositions() {
    const {dataset} = this;
    if (!dataset) return;

    const newPositions = this.generatePointPositionArray(dataset);
    this.scatterPlot.setPointPositions(newPositions);
  }

  private updateScatterPlotAttributes() {
    const {dataset} = this;
    if (!dataset) return;

    const pointColors = this.generatePointColorArray(dataset);
    const pointScaleFactors = this.generatePointScaleFactorArray(dataset);
    const labels = this.generateVisibleLabelRenderParams();

    this.scatterPlot.setPointColors(pointColors);
    this.scatterPlot.setPointScaleFactors(pointScaleFactors);
    this.scatterPlot.setLabels(labels);
  }

  private updatePolylineAttributes() {
    const {dataset} = this;
    if (!dataset) return;

    const polylineColors = this.generateLineSegmentColorMap(dataset);
    const polylineOpacities = this.generateLineSegmentOpacityArray(dataset);
    const polylineWidths = this.generateLineSegmentWidthArray(dataset);

    this.scatterPlot.setPolylineColors(polylineColors);
    this.scatterPlot.setPolylineOpacities(polylineOpacities);
    this.scatterPlot.setPolylineWidths(polylineWidths);
  }

  private generatePointPositionArray(dataset: Dataset): Float32Array {
    let xExtent = [0, 0];
    let yExtent = [0, 0];
    let zExtent = [0, 0];

    // Determine max and min of each axis of our data.
    xExtent = util.extent(dataset.points.map(p => p[0]));
    yExtent = util.extent(dataset.points.map(p => p[1]));

    if (dataset.dimensions === 3) {
      zExtent = util.extent(dataset.points.map(p => p[2]!));
    }

    const getRange = (extent: number[]) => Math.abs(extent[1] - extent[0]);
    const xRange = getRange(xExtent);
    const yRange = getRange(yExtent);
    const zRange = getRange(zExtent);
    const maxRange = Math.max(xRange, yRange, zRange);

    const halfCube = SCATTER_PLOT_CUBE_LENGTH / 2;
    const makeScaleRange = (range: number, base: number) => [
      -base * (range / maxRange),
      base * (range / maxRange),
    ];
    const xScale = makeScaleRange(xRange, halfCube);
    const yScale = makeScaleRange(yRange, halfCube);
    const zScale = makeScaleRange(zRange, halfCube);

    const positions = new Float32Array(dataset.points.length * 3);
    let dst = 0;

    dataset.points.forEach((d, i) => {
      const vector = dataset.points[i];

      positions[dst++] = util.scaleLinear(vector[0], xExtent, xScale);
      positions[dst++] = util.scaleLinear(vector[1], yExtent, yScale);

      if (dataset.dimensions === 3) {
        positions[dst++] = util.scaleLinear(vector[2]!, zExtent, zScale);
      } else {
        positions[dst++] = 0.0;
      }
    });
    return positions;
  }

  private generateVisibleLabelRenderParams(): LabelRenderParams {
    const {hoverPointIndex, selectedPointIndices, styles} = this;
    const n = hoverPointIndex !== null ? 1 : 0;

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
      const fillRgb = util.styleRgbFromHexColor(styles.label.fillColorSelected);
      const strokeRgb = util.styleRgbFromHexColor(
        styles.label.strokeColorSelected
      );

      if (selectedPointIndices.size === 1) {
        const labelIndex = [...selectedPointIndices][0];
        labelStrings.push(this.getLabelText(labelIndex));
        visibleLabels[dst] = labelIndex;
        scale[dst] = styles.label.scaleLarge;
        opacityFlags[dst] = 0;
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

  private generatePointScaleFactorArray(dataset: Dataset): Float32Array {
    const {hoverPointIndex, selectedPointIndices, styles} = this;

    const {scaleDefault, scaleSelected, scaleHover} = styles.point;

    const scale = new Float32Array(dataset.points.length);
    scale.fill(scaleDefault);

    const selectedPointCount = selectedPointIndices.size;

    // Scale up all selected points.
    {
      for (const p of selectedPointIndices.values()) {
        scale[p] = scaleSelected;
      }
    }

    // Scale up the hover point.
    if (hoverPointIndex != null) {
      scale[hoverPointIndex] = scaleHover;
    }

    return scale;
  }

  private generatePointColorArray(dataset: Dataset): Float32Array {
    const {hoverPointIndex, pointColorer, selectedPointIndices, styles} = this;

    const {
      colorHover,
      colorNoSelection,
      colorSelected,
      colorUnselected,
    } = styles.point;

    const colors = new Float32Array(dataset.points.length * RGBA_NUM_ELEMENTS);

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

    const n = dataset.points.length;
    const selectedPointCount = this.selectedPointIndices.size;

    // Color points with the point colorer, otherwise use default colors
    if (pointColorer) {
      let dst = 0;
      for (let i = 0; i < n; ++i) {
        const c = parseColor(
          this.callPointColorer(pointColorer, i) || noSelectionColor
        );

        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
        colors[dst++] = c.opacity;
      }
    }
    // Otherwise, determine whether to first color all points with the default
    // unselected color or the color where none is selected...
    else {
      // First color all unselected / non-selected points
      let dst = 0;
      let c =
        selectedPointCount > 0
          ? parseColor(unselectedColor)
          : parseColor(noSelectionColor);
      for (let i = 0; i < n; ++i) {
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
        colors[dst++] = c.opacity;
      }

      // Then, color selected points
      c = parseColor(colorSelected);
      for (const selectedPointIndex of selectedPointIndices.values()) {
        let dst = selectedPointIndex * RGBA_NUM_ELEMENTS;
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
        colors[dst++] = c.opacity;
      }

      // Last, color the hover point.
      if (hoverPointIndex != null) {
        const c = parseColor(colorHover);
        let dst = hoverPointIndex * RGBA_NUM_ELEMENTS;
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
        colors[dst++] = c.opacity;
      }
    }

    return colors;
  }

  private generate3DLabelsArray() {
    const {dataset} = this;
    if (!dataset) return [];

    let labels: string[] = [];
    const n = dataset.points.length;
    for (let i = 0; i < n; ++i) {
      labels.push(this.getLabelText(i));
    }
    return labels;
  }

  private generateLineSegmentColorMap(
    dataset: Dataset
  ): {
    [polylineIndex: number]: Float32Array;
  } {
    const {pointColorer, styles} = this;
    const polylineColorArrayMap: {[polylineIndex: number]: Float32Array} = {};

    for (let i = 0; i < this.sequences.length; i++) {
      let sequence = this.sequences[i];
      let colors = new Float32Array(2 * (sequence.indices.length - 1) * 3);
      let colorIndex = 0;

      if (pointColorer) {
        for (let j = 0; j < sequence.indices.length - 1; j++) {
          const c1 = parseColor(
            this.callPointColorer(pointColorer, sequence.indices[j])
          );
          const c2 = parseColor(
            this.callPointColorer(pointColorer, sequence.indices[j + 1])
          );
          colors[colorIndex++] = c1.r;
          colors[colorIndex++] = c1.g;
          colors[colorIndex++] = c1.b;
          colors[colorIndex++] = c2.r;
          colors[colorIndex++] = c2.g;
          colors[colorIndex++] = c2.b;
        }
      } else {
        for (let j = 0; j < sequence.indices.length - 1; j++) {
          const c1 = util.getDefaultPointInPolylineColor(
            j,
            sequence.indices.length,
            styles.polyline.startHue,
            styles.polyline.endHue,
            styles.polyline.saturation,
            styles.polyline.lightness
          );
          const c2 = util.getDefaultPointInPolylineColor(
            j + 1,
            sequence.indices.length,
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

  private generateLineSegmentOpacityArray(dataset: Dataset): Float32Array {
    const {selectedPointIndices, styles} = this;

    const opacities = new Float32Array(this.sequences.length);
    const selectedPointCount = selectedPointIndices.size;
    if (selectedPointCount > 0) {
      opacities.fill(styles.polyline.deselectedOpacity);
      const i = this.polylineVisualizer!.getPointSequenceIndex(
        [...selectedPointIndices][0]
      );
      if (i !== undefined) opacities[i] = styles.polyline.selectedOpacity;
    } else {
      opacities.fill(styles.polyline.defaultOpacity);
    }
    return opacities;
  }

  private generateLineSegmentWidthArray(dataset: Dataset): Float32Array {
    const {selectedPointIndices, styles} = this;

    const widths = new Float32Array(this.sequences.length);
    widths.fill(styles.polyline.defaultLineWidth);
    const selectedPointCount = selectedPointIndices.size;
    if (selectedPointCount > 0) {
      const i = this.polylineVisualizer!.getPointSequenceIndex(
        [...selectedPointIndices][0]
      );
      if (i !== undefined) widths[i] = styles.polyline.selectedLineWidth;
    }
    return widths;
  }

  private getLabelText(i: number) {
    const {dataset} = this;
    if (!dataset) return '';
    const metadata = dataset.metadata[i];
    return metadata && metadata.label != null ? `${metadata.label}` : '';
  }

  private initializeCanvasLabelsVisualizer() {
    if (!this.canvasLabelsVisualizer) {
      this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(
        this.containerElement!,
        this.styles
      );
    }
    return this.canvasLabelsVisualizer;
  }

  private initialize3DLabelsVisualizer() {
    if (!this.labels3DVisualizer) {
      this.labels3DVisualizer = new ScatterPlotVisualizer3DLabels(this.styles);
    }
    this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());
    return this.labels3DVisualizer;
  }

  private initializePointVisualizer() {
    if (!this.pointVisualizer) {
      this.pointVisualizer = new ScatterPlotVisualizerSprites(this.styles);
    }
    return this.pointVisualizer;
  }

  private initializeSpritesheetVisualizer() {
    const {styles} = this;
    const dataset = this.dataset!;
    const {spriteMetadata} = dataset;
    if (!this.spritesheetVisualizer && spriteMetadata) {
      if (!spriteMetadata.spriteImage || !spriteMetadata.singleSpriteSize) {
        return;
      }

      const n = dataset.points.length;

      let spriteIndices: Float32Array;
      if (spriteMetadata.spriteIndices) {
        spriteIndices = new Float32Array(spriteMetadata.spriteIndices);
      } else {
        spriteIndices = new Float32Array(n);
        for (let i = 0; i < n; ++i) {
          spriteIndices[i] = i;
        }
      }

      const onImageLoad = () => this.renderScatterPlot();

      const spritesheetVisualizer = new ScatterPlotVisualizerSprites(styles, {
        spritesheetImage: spriteMetadata.spriteImage,
        spriteDimensions: spriteMetadata.singleSpriteSize,
        spriteIndices,
        onImageLoad,
      });
      spritesheetVisualizer.id = 'SPRITE_SHEET_VISUALIZER';
      this.spritesheetVisualizer = spritesheetVisualizer;
    }
    return this.spritesheetVisualizer;
  }

  private initializePolylineVisualizer() {
    if (!this.polylineVisualizer) {
      this.polylineVisualizer = new ScatterPlotVisualizerPolylines();
    }
    this.polylineVisualizer.setSequences(this.sequences);
    return this.polylineVisualizer;
  }

  private setVisualizers() {
    const {dataset, renderMode} = this;

    const activeVisualizers: ScatterPlotVisualizer[] = [];

    if (renderMode === RenderMode.TEXT) {
      const visualizer = this.initialize3DLabelsVisualizer();
      activeVisualizers.push(visualizer);
    } else if (renderMode === RenderMode.POINT) {
      const visualizer = this.initializePointVisualizer();
      activeVisualizers.push(visualizer);
    } else if (renderMode === RenderMode.SPRITE && dataset!.spriteMetadata) {
      const visualizer = this.initializeSpritesheetVisualizer();
      if (visualizer) activeVisualizers.push(visualizer);
    }

    if (this.sequences.length > 0) {
      const visualizer = this.initializePolylineVisualizer();
      activeVisualizers.push(visualizer);
    }

    const textLabelsRenderMode =
      renderMode === RenderMode.POINT || renderMode === RenderMode.SPRITE;
    if (textLabelsRenderMode && this.showLabelsOnHover) {
      const visualizer = this.initializeCanvasLabelsVisualizer();
      activeVisualizers.push(visualizer);
    }

    this.scatterPlot.setActiveVisualizers(activeVisualizers);
  }

  static Dataset = Dataset;
}
