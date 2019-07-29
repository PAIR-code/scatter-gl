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
import * as util from './util';
import {
  LABEL_3D_FONT_SIZE,
  LABEL_3D_SCALE,
  LABEL_3D_COLOR,
  LABEL_3D_BACKGROUND,
  RGB_NUM_ELEMENTS,
  UV_NUM_ELEMENTS,
  XYZ_NUM_ELEMENTS,
} from './constants';

const MAX_CANVAS_DIMENSION = 8192;
const NUM_GLYPHS = 256;
const VERTICES_PER_GLYPH = 2 * 3; // 2 triangles, 3 verts per triangle

/**
 * Each label is made up of triangles (two per letter.) Each vertex, then, is
 * the corner of one of these triangles (and thus the corner of a letter
 * rectangle.)
 * Each has the following attributes:
 *    posObj: The (x, y) position of the vertex within the label, where the
 *            bottom center of the word is positioned at (0, 0);
 *    position: The position of the label in worldspace.
 *    vUv: The (u, v) coordinates that index into the glyphs sheet (range 0, 1.)
 *    color: The color of the label (matches the corresponding point's color.)
 *    wordShown: Boolean. Whether or not the label is visible.
 */

const VERTEX_SHADER = `
      attribute vec2 posObj;
      attribute vec3 color;
      varying vec2 vUv;
      varying vec3 vColor;
  
      void main() {
        vUv = uv;
        vColor = color;
  
        // Rotate label to face camera.
  
        vec4 vRight = vec4(
          modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0], 0);
  
        vec4 vUp = vec4(
          modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1], 0);
  
        vec4 vAt = -vec4(
          modelViewMatrix[0][2], modelViewMatrix[1][2], modelViewMatrix[2][2], 0);
  
        mat4 pointToCamera = mat4(vRight, vUp, vAt, vec4(0, 0, 0, 1));
  
        vec2 scaledPos = posObj * ${1 / LABEL_3D_FONT_SIZE} * ${LABEL_3D_SCALE};
  
        vec4 posRotated = pointToCamera * vec4(scaledPos, 0, 1);
        vec4 mvPosition = modelViewMatrix * (vec4(position, 0) + posRotated);
        gl_Position = projectionMatrix * mvPosition;
      }`;

const FRAGMENT_SHADER = `
      uniform sampler2D texture;
      uniform bool picking;
      varying vec2 vUv;
      varying vec3 vColor;
  
      void main() {
        if (picking) {
          gl_FragColor = vec4(vColor, 1.0);
        } else {
          vec4 fromTexture = texture2D(texture, vUv);
          gl_FragColor = vec4(vColor, 1.0) * fromTexture;
        }
      }`;

type GlyphTexture = {
  texture: THREE.Texture;
  lengths: Float32Array;
  offsets: Float32Array;
};

/**
 * Renders the text labels as 3d geometry in the world.
 */
export class ScatterPlotVisualizer3DLabels implements ScatterPlotVisualizer {
  private scene: THREE.Scene;
  private labelStrings: string[];
  private geometry: THREE.BufferGeometry;
  private worldSpacePointPositions: Float32Array;
  private pickingColors: Float32Array;
  private renderColors: Float32Array;
  private material: THREE.ShaderMaterial;
  private uniforms: Object;
  private labelsMesh: THREE.Mesh;
  private positions: THREE.BufferAttribute;
  private totalVertexCount: number;
  private labelVertexMap: number[][];
  private glyphTexture: GlyphTexture;

  private createGlyphTexture(): GlyphTexture {
    const canvas = document.createElement('canvas');
    canvas.width = MAX_CANVAS_DIMENSION;
    canvas.height = LABEL_3D_FONT_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold ' + LABEL_3D_FONT_SIZE + 'px roboto';
    ctx.textBaseline = 'top';
    ctx.fillStyle = LABEL_3D_BACKGROUND;
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.fill();
    ctx.fillStyle = LABEL_3D_COLOR;
    const spaceOffset = ctx.measureText(' ').width;
    // For each letter, store length, position at the encoded index.
    const glyphLengths = new Float32Array(NUM_GLYPHS);
    const glyphOffset = new Float32Array(NUM_GLYPHS);
    let leftCoord = 0;
    for (let i = 0; i < NUM_GLYPHS; i++) {
      const text = ' ' + String.fromCharCode(i);
      const textLength = ctx.measureText(text).width;
      glyphLengths[i] = textLength - spaceOffset;
      glyphOffset[i] = leftCoord;
      ctx.fillText(text, leftCoord - spaceOffset, 0);
      leftCoord += textLength;
    }
    const tex = util.createTextureFromCanvas(canvas);
    return { texture: tex, lengths: glyphLengths, offsets: glyphOffset };
  }

  private processLabelVerts(pointCount: number) {
    let numTotalLetters = 0;
    this.labelVertexMap = [];
    for (let i = 0; i < pointCount; i++) {
      const label = this.labelStrings[i];
      let vertsArray: number[] = [];
      for (let j = 0; j < label.length; j++) {
        for (let k = 0; k < VERTICES_PER_GLYPH; k++) {
          vertsArray.push(numTotalLetters * VERTICES_PER_GLYPH + k);
        }
        numTotalLetters++;
      }
      this.labelVertexMap.push(vertsArray);
    }
    this.totalVertexCount = numTotalLetters * VERTICES_PER_GLYPH;
  }

  private createColorBuffers(pointCount: number) {
    this.pickingColors = new Float32Array(
      this.totalVertexCount * RGB_NUM_ELEMENTS
    );
    this.renderColors = new Float32Array(
      this.totalVertexCount * RGB_NUM_ELEMENTS
    );
    for (let i = 0; i < pointCount; i++) {
      let color = new THREE.Color(i);
      this.labelVertexMap[i].forEach(j => {
        this.pickingColors[RGB_NUM_ELEMENTS * j] = color.r;
        this.pickingColors[RGB_NUM_ELEMENTS * j + 1] = color.g;
        this.pickingColors[RGB_NUM_ELEMENTS * j + 2] = color.b;
        this.renderColors[RGB_NUM_ELEMENTS * j] = 1.0;
        this.renderColors[RGB_NUM_ELEMENTS * j + 1] = 1.0;
        this.renderColors[RGB_NUM_ELEMENTS * j + 2] = 1.0;
      });
    }
  }

  private createLabels() {
    if (this.labelStrings == null || this.worldSpacePointPositions == null) {
      return;
    }
    const pointCount = this.worldSpacePointPositions.length / XYZ_NUM_ELEMENTS;
    if (pointCount !== this.labelStrings.length) {
      return;
    }
    this.glyphTexture = this.createGlyphTexture();

    this.uniforms = {
      texture: { type: 't' },
      picking: { type: 'bool' },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });

    this.processLabelVerts(pointCount);
    this.createColorBuffers(pointCount);

    let positionArray = new Float32Array(
      this.totalVertexCount * XYZ_NUM_ELEMENTS
    );
    this.positions = new THREE.BufferAttribute(positionArray, XYZ_NUM_ELEMENTS);

    let posArray = new Float32Array(this.totalVertexCount * XYZ_NUM_ELEMENTS);
    let uvArray = new Float32Array(this.totalVertexCount * UV_NUM_ELEMENTS);
    let colorsArray = new Float32Array(
      this.totalVertexCount * RGB_NUM_ELEMENTS
    );
    let positionObject = new THREE.BufferAttribute(posArray, 2);
    let uv = new THREE.BufferAttribute(uvArray, UV_NUM_ELEMENTS);
    let colors = new THREE.BufferAttribute(colorsArray, RGB_NUM_ELEMENTS);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.addAttribute('posObj', positionObject);
    this.geometry.addAttribute('position', this.positions);
    this.geometry.addAttribute('uv', uv);
    this.geometry.addAttribute('color', colors);

    let lettersSoFar = 0;
    for (let i = 0; i < pointCount; i++) {
      const label = this.labelStrings[i];
      let leftOffset = 0;
      // Determine length of word in pixels.
      for (let j = 0; j < label.length; j++) {
        let letterCode = label.charCodeAt(j);
        leftOffset += this.glyphTexture.lengths[letterCode];
      }
      leftOffset /= -2; // centers text horizontally around the origin
      for (let j = 0; j < label.length; j++) {
        let letterCode = label.charCodeAt(j);
        let letterWidth = this.glyphTexture.lengths[letterCode];
        let scale = LABEL_3D_FONT_SIZE;
        let right = (leftOffset + letterWidth) / scale;
        let left = leftOffset / scale;
        let top = LABEL_3D_FONT_SIZE / scale;

        // First triangle
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, left, 0);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, right, 0);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, left, top);

        // Second triangle
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 3, left, top);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 4, right, 0);
        positionObject.setXY(lettersSoFar * VERTICES_PER_GLYPH + 5, right, top);

        // Set UVs based on letter.
        let uLeft = this.glyphTexture.offsets[letterCode];
        let uRight = this.glyphTexture.offsets[letterCode] + letterWidth;
        // Scale so that uvs lie between 0 and 1 on the texture.
        uLeft /= MAX_CANVAS_DIMENSION;
        uRight /= MAX_CANVAS_DIMENSION;
        let vTop = 1;
        let vBottom = 0;
        uv.setXY(lettersSoFar * VERTICES_PER_GLYPH + 0, uLeft, vTop);
        uv.setXY(lettersSoFar * VERTICES_PER_GLYPH + 1, uRight, vTop);
        uv.setXY(lettersSoFar * VERTICES_PER_GLYPH + 2, uLeft, vBottom);
        uv.setXY(lettersSoFar * VERTICES_PER_GLYPH + 3, uLeft, vBottom);
        uv.setXY(lettersSoFar * VERTICES_PER_GLYPH + 4, uRight, vTop);
        uv.setXY(lettersSoFar * VERTICES_PER_GLYPH + 5, uRight, vBottom);

        lettersSoFar++;
        leftOffset += letterWidth;
      }
    }

    for (let i = 0; i < pointCount; i++) {
      const p = util.vector3FromPackedArray(this.worldSpacePointPositions, i);
      this.labelVertexMap[i].forEach(j => {
        this.positions.setXYZ(j, p.x, p.y, p.z);
      });
    }

    this.labelsMesh = new THREE.Mesh(this.geometry, this.material);
    this.labelsMesh.frustumCulled = false;
    this.scene.add(this.labelsMesh);
  }

  private colorLabels(pointColors: Float32Array) {
    if (
      this.labelStrings == null ||
      this.geometry == null ||
      pointColors == null
    ) {
      return;
    }

    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    colors.array = this.renderColors;

    const n = pointColors.length / XYZ_NUM_ELEMENTS;
    let src = 0;
    for (let i = 0; i < n; ++i) {
      const c = new THREE.Color(
        pointColors[src],
        pointColors[src + 1],
        pointColors[src + 2]
      );
      const m = this.labelVertexMap[i].length;
      for (let j = 0; j < m; ++j) {
        colors.setXYZ(this.labelVertexMap[i][j], c.r, c.g, c.b);
      }
      src += RGB_NUM_ELEMENTS;
    }
    colors.needsUpdate = true;
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  dispose() {
    if (this.labelsMesh) {
      if (this.scene) {
        this.scene.remove(this.labelsMesh);
      }
      (this.labelsMesh as any) = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      (this.geometry as any) = null;
    }
    if (this.glyphTexture != null && this.glyphTexture.texture != null) {
      this.glyphTexture.texture.dispose();
      (this.glyphTexture as any).texture = null;
    }
  }

  onPickingRender(rc: RenderContext) {
    if (this.geometry == null) {
      this.createLabels();
    }
    if (this.geometry == null) {
      return;
    }
    this.material.uniforms.texture.value = this.glyphTexture.texture;
    this.material.uniforms.picking.value = true;
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    colors.array = this.pickingColors;
    colors.needsUpdate = true;
  }

  onRender(rc: RenderContext) {
    if (this.geometry == null) {
      this.createLabels();
    }
    if (this.geometry == null) {
      return;
    }
    // Only do this if the user selects a label coloring scheme...

    // this.colorLabels(rc.pointColors);
    this.material.uniforms.texture.value = this.glyphTexture.texture;
    this.material.uniforms.picking.value = false;
    const colors = this.geometry.getAttribute('color') as THREE.BufferAttribute;
    colors.array = this.renderColors;
    colors.needsUpdate = true;
  }

  onPointPositionsChanged(newPositions: Float32Array) {
    this.worldSpacePointPositions = newPositions;
    this.dispose();
  }

  setLabelStrings(labelStrings: string[]) {
    this.labelStrings = labelStrings;
    this.dispose();
  }

  onResize(newWidth: number, newHeight: number) {}
}
