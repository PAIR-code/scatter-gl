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

import {Styles} from './styles';
import * as simplify from 'simplify-js';


export const enum SelectionMode {
  BOX = 'BOX',
  LASSO = 'LASSO',
}
export interface ScatterBoundingBox {
  // The bounding box (x, y) position refers to the bottom left corner of the
  // rect.
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}



/**
 * A class that manages and renders a data selection rectangle.
 */
export class ScatterPlotRectangleSelector {
  private svgElement: SVGElement;
  private rectElement: SVGRectElement;
  private lassoElement: SVGPathElement;

  private isMouseDown: boolean;
  private startCoordinates: [number, number] = [0, 0];
  private lastBoundingBox!: ScatterBoundingBox;
  private lassoPath:Point[] = [];
  private selectionMode:SelectionMode = SelectionMode.BOX;
  private selectionCallback: (boundingBox: ScatterBoundingBox) => void;
  private lassoCallback: (lassoPoints: Point[]) => void;

  /**
   * @param container The container HTML element that the selection SVG rect
   *     will be a child of.
   * @param selectionCallback The callback that accepts a bounding box to be
   *     called when selection changes. Currently, we only call the callback on
   *     mouseUp.
   * @param styles The styles object.
   */
  constructor(
    container: HTMLElement,
    selectionCallback: (boundingBox: ScatterBoundingBox) => void,
    lassoCallback: (lassoPoints: Point[]) => void,
    styles: Styles
  ) {
    this.svgElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );
    this.svgElement.style.display = 'none';
    this.svgElement.style.height = '100%';
    this.svgElement.style.width = '100%';
    this.svgElement.style.position = 'absolute';

    container.insertAdjacentElement('afterbegin', this.svgElement);

    this.rectElement = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'rect'
    );
    this.lassoElement = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'path'
    );

    [this.rectElement, this.lassoElement].forEach(element => {
      element.style.stroke = styles.select.stroke;
      element.style.strokeDasharray = styles.select.strokeDashArray;
      element.style.strokeWidth = `${styles.select.strokeWidth}`;
      element.style.fill = styles.select.fill;
      element.style.fillOpacity = `${styles.select.fillOpacity}`;
      this.svgElement.appendChild(element);
    });

    this.selectionCallback = selectionCallback;
    this.lassoCallback = lassoCallback;
    this.isMouseDown = false;
  }

  setSelectionMode(selectionMode: SelectionMode) {
    this.selectionMode = selectionMode;
  }

  onMouseDown(offsetX: number, offsetY: number) {
    this.isMouseDown = true;
    if(this.selectionMode===SelectionMode.BOX) {
      this.rectElement.style.display = 'block';
    } else {
      this.lassoElement.style.display = 'block';
    }
    this.svgElement.style.display = 'block';

    if (this.selectionMode === SelectionMode.BOX) {
      this.startCoordinates = [offsetX, offsetY];
      this.lastBoundingBox = {
        x: this.startCoordinates[0],
        y: this.startCoordinates[1],
        width: 1,
        height: 1,
      };
    }else {
      this.lassoPath = [{x:offsetX, y:offsetY}];
    }
  }

  onMouseMove(offsetX: number, offsetY: number) {
    if (!this.isMouseDown) {
      return;
    }

    if (this.selectionMode === SelectionMode.BOX) {
      this.lastBoundingBox.x = Math.min(offsetX, this.startCoordinates[0]);
      this.lastBoundingBox.y = Math.max(offsetY, this.startCoordinates[1]);
      this.lastBoundingBox.width =
          Math.max(offsetX, this.startCoordinates[0]) - this.lastBoundingBox.x;
      this.lastBoundingBox.height =
          this.lastBoundingBox.y - Math.min(offsetY, this.startCoordinates[1]);

      this.rectElement.setAttribute('x', '' + this.lastBoundingBox.x);
      this.rectElement.setAttribute(
          'y',
          '' + (this.lastBoundingBox.y - this.lastBoundingBox.height)
      );
      this.rectElement.setAttribute('width', '' + this.lastBoundingBox.width);
      this.rectElement.setAttribute('height', '' + this.lastBoundingBox.height);
    } else {
      this.lassoPath.push({x: offsetX, y: offsetY});
      let points = this.lassoPath.length > 3 ? simplify(this.lassoPath, 0.1) : this.lassoPath;
      let d = ['M', points[0].x, points[0].y];
      for (let i = 1; i < points.length; i++) {
        d.push('L');
        d.push(points[i].x);
        d.push(points[i].y)
      }
      d.push('Z')
      this.lassoElement.setAttribute('d', d.join(' '));
    }
  }

  onMouseUp() {
    this.isMouseDown = false;
    this.svgElement.style.display = 'none';
    this.rectElement.style.display = 'none';
    this.lassoElement.style.display = 'none';
    this.lassoElement.setAttribute('d', '');
    this.rectElement.setAttribute('width', '0');
    this.rectElement.setAttribute('height', '0');
    if (this.selectionMode === SelectionMode.BOX) {
      this.selectionCallback(this.lastBoundingBox);
    } else {
      let points = this.lassoPath.length > 3 ? simplify(this.lassoPath, 0.1) : this.lassoPath;
      this.lassoCallback(points);
      this.lassoPath = [];
    }
  }
}
