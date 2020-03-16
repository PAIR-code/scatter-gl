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
import {Styles} from './styles';
import * as util from './util';
import {
  RGB_NUM_ELEMENTS,
  RGBA_NUM_ELEMENTS,
  INDEX_NUM_ELEMENTS,
  XYZ_NUM_ELEMENTS,
} from './constants';

export interface SpriteSheetParams {
  spritesheetImage: HTMLImageElement | string;
  spriteDimensions: [number, number];
  spriteIndices: Float32Array;
  onImageLoad: () => void;
}

const makeVertexShader = (minPointSize: number) => `
    // Index of the specific vertex (passed in as bufferAttribute), and the
    // variable that will be used to pass it to the fragment shader.
    attribute float spriteIndex;
    attribute vec4 color;
    attribute float scaleFactor;

    varying vec2 xyIndex;
    varying vec4 vColor;

    uniform bool sizeAttenuation;
    uniform float pointSize;
    uniform float spritesPerRow;
    uniform float spritesPerColumn;

    varying float fogDepth;

    void main() {
      // Pass index and color values to fragment shader.
      vColor = color;
      xyIndex = vec2(mod(spriteIndex, spritesPerRow),
                floor(spriteIndex / spritesPerColumn));

      // Transform current vertex by modelViewMatrix (model world position and
      // camera world position matrix).
      vec4 cameraSpacePos = modelViewMatrix * vec4(position, 1.0);

      // Project vertex in camera-space to screen coordinates using the camera's
      // projection matrix.
      gl_Position = projectionMatrix * cameraSpacePos;

      // Create size attenuation (if we're in 3D mode) by making the size of
      // each point inversly proportional to its distance to the camera.
      float outputPointSize = pointSize;
      if (sizeAttenuation) {
        outputPointSize = -pointSize / cameraSpacePos.z;
        fogDepth = pointSize / outputPointSize * 1.2;
      } else {  // Create size attenuation (if we're in 2D mode)
        const float PI = 3.1415926535897932384626433832795;
        const float minScale = 0.1;  // minimum scaling factor
        const float outSpeed = 2.0;  // shrink speed when zooming out
        const float outNorm = (1. - minScale) / atan(outSpeed);
        const float maxScale = 15.0;  // maximum scaling factor
        const float inSpeed = 0.02;  // enlarge speed when zooming in
        const float zoomOffset = 0.3;  // offset zoom pivot
        float zoom = projectionMatrix[0][0] + zoomOffset;  // zoom pivot
        float scale = zoom < 1. ? 1. + outNorm * atan(outSpeed * (zoom - 1.)) :
                      1. + 2. / PI * (maxScale - 1.) * atan(inSpeed * (zoom - 1.));
        outputPointSize = pointSize * scale;
      }

      gl_PointSize =
        max(outputPointSize * scaleFactor, ${minPointSize.toFixed(1)});
    }`;

const FRAGMENT_SHADER_POINT_TEST_CHUNK = `
    bool point_in_unit_circle(vec2 spriteCoord) {
      vec2 centerToP = spriteCoord - vec2(0.5, 0.5);
      return dot(centerToP, centerToP) < (0.5 * 0.5);
    }

    bool point_in_unit_equilateral_triangle(vec2 spriteCoord) {
      vec3 v0 = vec3(0, 1, 0);
      vec3 v1 = vec3(0.5, 0, 0);
      vec3 v2 = vec3(1, 1, 0);
      vec3 p = vec3(spriteCoord, 0);
      float p_in_v0_v1 = cross(v1 - v0, p - v0).z;
      float p_in_v1_v2 = cross(v2 - v1, p - v1).z;
      return (p_in_v0_v1 > 0.0) && (p_in_v1_v2 > 0.0);
    }

    bool point_in_unit_square(vec2 spriteCoord) {
      return true;
    }
  `;

const FRAGMENT_SHADER = `
    varying vec2 xyIndex;
    varying vec4 vColor;

    uniform sampler2D texture;
    uniform float spritesPerRow;
    uniform float spritesPerColumn;
    uniform bool isImage;

    ${THREE.ShaderChunk['common']}
    ${FRAGMENT_SHADER_POINT_TEST_CHUNK}
    uniform vec3 fogColor;
    varying float fogDepth;
		uniform float fogNear;
    uniform float fogFar;

    void main() {
      if (isImage) {
        // Coordinates of the vertex within the entire sprite image.
        vec2 coords =
          (gl_PointCoord + xyIndex) / vec2(spritesPerRow, spritesPerColumn);
        gl_FragColor = vColor * texture2D(texture, coords);
      } else {
        bool inside = point_in_unit_circle(gl_PointCoord);
        if (!inside) {
          discard;
        }
        gl_FragColor = vColor;
      }
      float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
      gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
    }`;

const FRAGMENT_SHADER_PICKING = `
    varying vec2 xyIndex;
    varying vec4 vColor;
    uniform bool isImage;

    ${FRAGMENT_SHADER_POINT_TEST_CHUNK}

    varying float fogDepth;

    void main() {
      xyIndex; // Silence 'unused variable' warning.
      fogDepth; // Silence 'unused variable' warning.
      if (isImage) {
        gl_FragColor = vColor;
      } else {
        bool inside = point_in_unit_circle(gl_PointCoord);
        if (!inside) {
          discard;
        }
        gl_FragColor = vColor;
      }
    }`;

/**
 * Uses GL point sprites, either generated or from a spritesheet image to
 * render the dataset.
 */
export class ScatterPlotVisualizerSprites implements ScatterPlotVisualizer {
  public id = 'SPRITES';

  private scene!: THREE.Scene;
  private fog!: THREE.Fog;
  private texture!: THREE.Texture;

  private standinTextureForPoints: THREE.Texture;
  private spriteIndexBufferAttribute!: THREE.BufferAttribute;
  private renderMaterial: THREE.ShaderMaterial;
  private pickingMaterial: THREE.ShaderMaterial;

  private isSpriteSheetMode = false;
  private spriteSheetParams!: SpriteSheetParams;
  private spriteSheetImage!: HTMLImageElement;
  private spritesPerRow = 0;
  private spritesPerColumn = 0;
  private spriteDimensions = [0, 0];

  private points!: THREE.Points;
  private worldSpacePointPositions = new Float32Array(0);
  private pickingColors = new Float32Array(0);
  private renderColors = new Float32Array(0);

  constructor(private styles: Styles, spriteSheetParams?: SpriteSheetParams) {
    this.standinTextureForPoints = util.createTextureFromCanvas(
      document.createElement('canvas')
    );

    if (spriteSheetParams) {
      this.spriteSheetParams = spriteSheetParams;
      this.setSpriteSheet(spriteSheetParams);
      this.isSpriteSheetMode = true;
    }

    this.renderMaterial = this.createRenderMaterial();
    this.pickingMaterial = this.createPickingMaterial();
  }

  private createUniforms(): any {
    return {
      texture: {type: 't'},
      spritesPerRow: {type: 'f'},
      spritesPerColumn: {type: 'f'},
      fogColor: {type: 'c'},
      fogNear: {type: 'f'},
      fogFar: {type: 'f'},
      isImage: {type: 'bool'},
      sizeAttenuation: {type: 'bool'},
      pointSize: {type: 'f'},
    };
  }

  private createRenderMaterial(): THREE.ShaderMaterial {
    const {isSpriteSheetMode} = this;
    const uniforms = this.createUniforms();
    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: makeVertexShader(this.styles.sprites.minPointSize),
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthFunc: THREE.LessDepth,
      fog: this.styles.fog.enabled,
      blending: THREE.NormalBlending,
    });
  }

  private createPickingMaterial(): THREE.ShaderMaterial {
    const uniforms = this.createUniforms();
    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: makeVertexShader(this.styles.sprites.minPointSize),
      fragmentShader: FRAGMENT_SHADER_PICKING,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      fog: false,
      blending: THREE.NormalBlending,
    });
  }

  /**
   * Create points, set their locations and actually instantiate the
   * geometry.
   */
  private createPointSprites(scene: THREE.Scene, positions: Float32Array) {
    const pointCount =
      positions != null ? positions.length / XYZ_NUM_ELEMENTS : 0;
    const geometry = this.createGeometry(pointCount);

    this.fog = new THREE.Fog(0xffffff); // unused value, gets overwritten.

    this.points = new THREE.Points(geometry, this.renderMaterial);
    this.points.frustumCulled = false;
    if (this.spriteIndexBufferAttribute != null) {
      (this.points.geometry as THREE.BufferGeometry).setAttribute(
        'spriteIndex',
        this.spriteIndexBufferAttribute
      );
    }
    scene.add(this.points);
  }

  private calculatePointSize(sceneIs3D: boolean): number {
    const {imageSize} = this.styles.sprites;
    if (this.texture) {
      return sceneIs3D ? imageSize : this.spriteDimensions[0];
    }
    const n =
      this.worldSpacePointPositions != null
        ? this.worldSpacePointPositions.length / XYZ_NUM_ELEMENTS
        : 1;
    const SCALE = 200;
    const LOG_BASE = 8;
    const DIVISOR = 1.5;
    // Scale point size inverse-logarithmically to the number of points.
    const pointSize = SCALE / Math.log(n) / Math.log(LOG_BASE);
    return sceneIs3D ? pointSize : pointSize / DIVISOR;
  }

  /**
   * Set up buffer attributes to be used for the points/images.
   */
  private createGeometry(pointCount: number): THREE.BufferGeometry {
    const n = pointCount;

    // Fill pickingColors with each point's unique id as its color.
    this.pickingColors = new Float32Array(n * RGBA_NUM_ELEMENTS);
    {
      let dst = 0;
      for (let i = 0; i < n; i++) {
        const c = new THREE.Color(i);
        this.pickingColors[dst++] = c.r;
        this.pickingColors[dst++] = c.g;
        this.pickingColors[dst++] = c.b;
        this.pickingColors[dst++] = 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([]), XYZ_NUM_ELEMENTS)
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array([]), RGBA_NUM_ELEMENTS)
    );
    geometry.setAttribute(
      'scaleFactor',
      new THREE.BufferAttribute(new Float32Array([]), INDEX_NUM_ELEMENTS)
    );
    geometry.computeVertexNormals();
    return geometry;
  }

  private setFogDistances(
    sceneIs3D: boolean,
    nearestPointZ: number,
    farthestPointZ: number
  ) {
    const {threshold, enabled} = this.styles.fog;

    if (sceneIs3D && enabled) {
      const n = this.worldSpacePointPositions.length / XYZ_NUM_ELEMENTS;
      this.fog.near = nearestPointZ;
      // If there are fewer points we want less fog. We do this
      // by making the "far" value (that is, the distance from the camera to the
      // far edge of the fog) proportional to the number of points.
      let multiplier = 2 - Math.min(n, threshold) / threshold;
      this.fog.far = farthestPointZ * multiplier;
    } else {
      this.fog.near = Infinity;
      this.fog.far = Infinity;
    }
  }

  dispose() {
    this.disposeGeometry();
    this.disposeSpriteSheet();
  }

  private disposeGeometry() {
    if (this.points != null) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
      (this.points as any) = null;
      (this.worldSpacePointPositions as any) = null;
    }
  }

  private disposeSpriteSheet() {
    if (this.texture) {
      this.texture.dispose();
    }
    (this.texture as any) = null;
    (this.renderMaterial as any) = null;
    (this.pickingMaterial as any) = null;
    (this.spriteSheetImage as any) = null;
  }

  setScene(scene: THREE.Scene) {
    this.scene = scene;
  }

  private setSpriteSheet(spriteSheetParams: SpriteSheetParams) {
    const {spriteDimensions, spriteIndices, onImageLoad} = spriteSheetParams;
    let spriteSheet = spriteSheetParams.spritesheetImage;

    // Load the sprite sheet as an image if a URL is supplied
    if (typeof spriteSheet === 'string') {
      const spriteSheetUrl = spriteSheet;
      spriteSheet = new Image();
      spriteSheet.src = spriteSheetUrl;
    }
    this.spriteSheetImage = spriteSheet as HTMLImageElement;

    // Create texture from sprite sheet image
    this.texture = util.createTextureFromImage(this.spriteSheetImage, () => {
      // Set the sprites per row uniforms when the image is finally loaded
      this.spritesPerRow = this.spriteSheetImage.width / spriteDimensions[0];
      this.spritesPerColumn =
        this.spriteSheetImage.height / spriteDimensions[1];
      onImageLoad();
    });
    this.spriteDimensions = spriteDimensions;
    this.spriteIndexBufferAttribute = new THREE.BufferAttribute(
      spriteIndices,
      INDEX_NUM_ELEMENTS
    );

    if (this.points != null) {
      (this.points.geometry as THREE.BufferGeometry).setAttribute(
        'spriteIndex',
        this.spriteIndexBufferAttribute
      );
    }
  }

  onPointPositionsChanged(newPositions: Float32Array) {
    if (this.points != null) {
      if (this.worldSpacePointPositions.length !== newPositions.length) {
        this.disposeGeometry();
      }
    }

    this.worldSpacePointPositions = newPositions;

    if (this.points == null) {
      this.createPointSprites(this.scene, newPositions);
    }

    if (this.spriteSheetParams) {
      this.setSpriteSheet(this.spriteSheetParams);
    }

    this.renderMaterial = this.createRenderMaterial();
    this.pickingMaterial = this.createPickingMaterial();

    const positions = (this.points
      .geometry as THREE.BufferGeometry).getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    positions.array = newPositions;
    positions.count = newPositions.length / XYZ_NUM_ELEMENTS;
    positions.needsUpdate = true;
  }

  onPickingRender(rc: RenderContext) {
    const sceneIs3D: boolean = rc.cameraType === CameraType.Perspective;

    this.pickingMaterial.uniforms.spritesPerRow.value = this.spritesPerRow;
    this.pickingMaterial.uniforms.spritesPerRow.value = this.spritesPerColumn;
    this.pickingMaterial.uniforms.sizeAttenuation.value = sceneIs3D;
    this.pickingMaterial.uniforms.pointSize.value = this.calculatePointSize(
      sceneIs3D
    );
    this.points.material = this.pickingMaterial;

    let colors = (this.points.geometry as THREE.BufferGeometry).getAttribute(
      'color'
    ) as THREE.BufferAttribute;
    colors.array = this.pickingColors;
    colors.count = this.pickingColors.length / RGBA_NUM_ELEMENTS;
    colors.needsUpdate = true;

    let scaleFactors = (this.points
      .geometry as THREE.BufferGeometry).getAttribute(
      'scaleFactor'
    ) as THREE.BufferAttribute;
    scaleFactors.array = rc.pointScaleFactors;
    scaleFactors.count = rc.pointScaleFactors.length;
    scaleFactors.count = rc.pointScaleFactors.length / INDEX_NUM_ELEMENTS;
    scaleFactors.needsUpdate = true;
  }

  onRender(rc: RenderContext) {
    const sceneIs3D: boolean = rc.camera instanceof THREE.PerspectiveCamera;
    this.setFogDistances(
      sceneIs3D,
      rc.nearestCameraSpacePointZ,
      rc.farthestCameraSpacePointZ
    );
    this.scene.fog = this.fog;
    this.scene.fog.color = new THREE.Color(rc.backgroundColor);
    this.renderMaterial.uniforms.fogColor.value = this.scene.fog.color;
    this.renderMaterial.uniforms.fogNear.value = this.fog.near;
    this.renderMaterial.uniforms.fogFar.value = this.fog.far;
    this.renderMaterial.uniforms.spritesPerRow.value = this.spritesPerRow;
    this.renderMaterial.uniforms.spritesPerColumn.value = this.spritesPerColumn;
    this.renderMaterial.uniforms.isImage.value = this.texture != null;
    this.renderMaterial.uniforms.texture.value =
      this.texture != null ? this.texture : this.standinTextureForPoints;
    this.renderMaterial.uniforms.sizeAttenuation.value = sceneIs3D;
    this.renderMaterial.uniforms.pointSize.value = this.calculatePointSize(
      sceneIs3D
    );
    this.points.material = this.renderMaterial;
    let colors = (this.points.geometry as THREE.BufferGeometry).getAttribute(
      'color'
    ) as THREE.BufferAttribute;
    this.renderColors = rc.pointColors;
    colors.array = this.renderColors;
    colors.count = this.renderColors.length / RGBA_NUM_ELEMENTS;
    colors.needsUpdate = true;
    let scaleFactors = (this.points
      .geometry as THREE.BufferGeometry).getAttribute(
      'scaleFactor'
    ) as THREE.BufferAttribute;
    scaleFactors.array = rc.pointScaleFactors;
    scaleFactors.count = rc.pointScaleFactors.length / INDEX_NUM_ELEMENTS;
    scaleFactors.needsUpdate = true;
  }

  onResize(newWidth: number, newHeight: number) {}
}
