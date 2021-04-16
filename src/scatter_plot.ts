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
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';

import {CameraType, LabelRenderParams, RenderContext} from './render';
import {Styles} from './styles';
import {Optional, Point2D, Point3D, InteractionMode} from './types';
import * as util from './util';

import {ScatterPlotVisualizer} from './scatter_plot_visualizer';
import {
  ScatterBoundingBox,
  ScatterPlotRectangleSelector,
} from './scatter_plot_rectangle_selector';

/**
 * The length of the cube (diameter of the circumscribing sphere) where all the
 * points live.
 */
const CUBE_LENGTH = 2;
const MAX_ZOOM = 5 * CUBE_LENGTH;
const MIN_ZOOM = 0.025 * CUBE_LENGTH;

// Constants relating to the camera parameters.
const PERSP_CAMERA_FOV_VERTICAL = 70;
const PERSP_CAMERA_NEAR_CLIP_PLANE = 0.01;
const PERSP_CAMERA_FAR_CLIP_PLANE = 100;
const ORTHO_CAMERA_FRUSTUM_HALF_EXTENT = 1.2;

// Key presses.
const SHIFT_KEY = 16;
const CTRL_KEY = 17;

const START_CAMERA_POS_3D = new THREE.Vector3(0.45, 0.9, 1.6);
const START_CAMERA_TARGET_3D = new THREE.Vector3(0, 0, 0);
const START_CAMERA_POS_2D = new THREE.Vector3(0, 0, 4);
const START_CAMERA_TARGET_2D = new THREE.Vector3(0, 0, 0);

export interface OrbitControlParams {
  mouseRotateSpeed: number;
  autoRotateSpeed: number;
  zoomSpeed: number;
}

const DEFAULT_ORBIT_CONTROL_PARAMS: OrbitControlParams = {
  mouseRotateSpeed: 1,
  autoRotateSpeed: 2,
  zoomSpeed: 0.125,
};

export type OnCameraMoveListener = (
  cameraPosition: THREE.Vector3,
  cameraTarget: THREE.Vector3
) => void;

/** Defines a camera, suitable for serialization. */
export interface CameraDef {
  orthographic: boolean;
  position: Point3D;
  target: Point3D;
  zoom: number;
}

export type CameraParams = Partial<
  Pick<CameraDef, 'position' | 'target' | 'zoom'>
>;

export interface ScatterPlotParams {
  camera?: CameraParams;
  onClick?: (point: number | null) => void;
  onHover?: (point: number | null) => void;
  onSelect?: (points: number[]) => void;
  selectEnabled?: boolean;
  styles: Styles;
  orbitControlParams?: Optional<OrbitControlParams>;
}

/**
 * Maintains a three.js instantiation and context,
 * animation state, and all other logic that's
 * independent of how a 3D scatter plot is actually rendered. Also holds an
 * array of visualizers and dispatches application events to them.
 */
export class ScatterPlot {
  private container: HTMLElement;
  private styles: Styles;
  private clickCallback: (point: number | null) => void = () => {};
  private hoverCallback: (point: number | null) => void = () => {};
  private selectCallback: (point: number[]) => void = () => {};
  private selectEnabled = true;

  // Map of visualizers by visualizer name/id
  private visualizers = new Map<string, ScatterPlotVisualizer>();

  private onCameraMoveListeners: OnCameraMoveListener[] = [];

  private height = 0;
  private width = 0;
  private dimensions = 3;

  private interactionMode = InteractionMode.PAN;

  private renderer: THREE.WebGLRenderer;

  private scene: THREE.Scene;
  private pickingTexture = new THREE.WebGLRenderTarget(0, 0);
  private light: THREE.PointLight;

  private camera!: THREE.Camera;
  private orbitAnimationOnNextCameraCreation: boolean = false;
  private orbitCameraControls: any;
  private orbitAnimationId: number | null = null;

  private worldSpacePointPositions = new Float32Array(0);
  private pointColors = new Float32Array(0);
  private pointScaleFactors = new Float32Array(0);
  private labels?: LabelRenderParams;
  private polylineColors: {[polylineIndex: number]: Float32Array} = {};
  private polylineOpacities = new Float32Array(0);
  private polylineWidths = new Float32Array(0);

  private selecting = false;
  private nearestPoint: number | null = null;
  private mouseIsDown = false;
  private isDragSequence = false;
  private rectangleSelector: ScatterPlotRectangleSelector;

  private readonly orbitControlParams: OrbitControlParams;

  constructor(containerElement: HTMLElement, params: ScatterPlotParams) {
    this.container = containerElement;
    this.styles = params.styles;
    this.setParameters(params);

    this.computeLayoutValues();

    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    });
    this.renderer.setClearColor(this.styles.backgroundColor, 1);
    this.container.appendChild(this.renderer.domElement);
    this.light = new THREE.PointLight(0xffecbf, 1, 0);
    this.scene.add(this.light);

    this.orbitControlParams = {
      ...DEFAULT_ORBIT_CONTROL_PARAMS,
      ...params.orbitControlParams,
    };

    this.rectangleSelector = new ScatterPlotRectangleSelector(
      this.container,
      (boundingBox: ScatterBoundingBox) => {
        this.selectBoundingBox(boundingBox);
      },
      this.styles
    );
    this.addInteractionListeners();
    this.setDimensions(3);
    this.makeCamera(params.camera);
    this.resize();
  }

  private setParameters(p: ScatterPlotParams) {
    if (p.onClick !== undefined) this.clickCallback = p.onClick;
    if (p.onHover !== undefined) this.hoverCallback = p.onHover;
    if (p.onSelect !== undefined) this.selectCallback = p.onSelect;
    if (p.selectEnabled !== undefined) this.selectEnabled = p.selectEnabled;
  }

  private addInteractionListeners() {
    this.container.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.container.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.container.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.container.addEventListener('click', this.onClick.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this), false);
    window.addEventListener('keyup', this.onKeyUp.bind(this), false);
  }

  private addCameraControlsEventListeners(cameraControls: any) {
    // Start is called when the user stars interacting with
    // controls.
    cameraControls.addEventListener('start', () => {
      this.stopOrbitAnimation();
      this.onCameraMoveListeners.forEach(l =>
        l(this.camera.position, cameraControls.target)
      );
    });

    // Change is called everytime the user interacts with the controls.
    cameraControls.addEventListener('change', () => {
      this.render();
    });

    // End is called when the user stops interacting with the
    // controls (e.g. on mouse up, after dragging).
    cameraControls.addEventListener('end', () => {});
  }

  private makeOrbitControls(camera: THREE.Camera, cameraIs3D: boolean) {
    if (this.orbitCameraControls != null) {
      this.orbitCameraControls.dispose();
    }

    const occ = new OrbitControls(camera, this.renderer.domElement);

    occ.zoomSpeed = this.orbitControlParams.zoomSpeed;
    occ.enableRotate = cameraIs3D;
    occ.autoRotate = false;
    occ.enableKeys = false;
    occ.rotateSpeed = this.orbitControlParams.mouseRotateSpeed;
    if (cameraIs3D) {
      occ.mouseButtons.LEFT = THREE.MOUSE.LEFT; // Orbit
      occ.mouseButtons.RIGHT = THREE.MOUSE.RIGHT; // Pan
    } else {
      occ.mouseButtons.LEFT = THREE.MOUSE.RIGHT; // Orbit
      occ.mouseButtons.RIGHT = THREE.MOUSE.LEFT; //Pan
    }
    occ.reset();

    this.camera = camera;
    this.orbitCameraControls = occ;

    this.addCameraControlsEventListeners(this.orbitCameraControls);
  }

  private makeCamera(cameraParams: CameraParams = {}) {
    const def = this.makeDefaultCameraDef(this.dimensions, cameraParams);
    this.recreateCamera(def);

    if (this.dimensions === 3 && this.styles.axesVisible) {
      this.add3dAxes();
    } else {
      this.remove3dAxesFromScene();
    }
  }

  private makeCamera3D(cameraDef: CameraDef, w: number, h: number) {
    let camera: THREE.PerspectiveCamera;
    {
      const aspectRatio = w / h;
      camera = new THREE.PerspectiveCamera(
        PERSP_CAMERA_FOV_VERTICAL,
        aspectRatio,
        PERSP_CAMERA_NEAR_CLIP_PLANE,
        PERSP_CAMERA_FAR_CLIP_PLANE
      );
      camera.position.set(
        cameraDef.position[0],
        cameraDef.position[1],
        cameraDef.position[2]
      );
      const at = new THREE.Vector3(
        cameraDef.target[0],
        cameraDef.target[1],
        cameraDef.target[2]
      );
      camera.lookAt(at);
      camera.zoom = cameraDef.zoom;
      camera.updateProjectionMatrix();
    }
    this.camera = camera;
    this.makeOrbitControls(camera, true);
  }

  private makeCamera2D(cameraDef: CameraDef, w: number, h: number) {
    let camera: THREE.OrthographicCamera;
    const target = new THREE.Vector3(
      cameraDef.target[0],
      cameraDef.target[1],
      cameraDef.target[2]
    );
    {
      const aspectRatio = w / h;
      let left = -ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
      let right = ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
      let bottom = -ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
      let top = ORTHO_CAMERA_FRUSTUM_HALF_EXTENT;
      // Scale up the larger of (w, h) to match the aspect ratio.
      if (aspectRatio > 1) {
        left *= aspectRatio;
        right *= aspectRatio;
      } else {
        top /= aspectRatio;
        bottom /= aspectRatio;
      }
      camera = new THREE.OrthographicCamera(
        left,
        right,
        top,
        bottom,
        -1000,
        1000
      );
      camera.position.set(
        cameraDef.position[0],
        cameraDef.position[1],
        cameraDef.position[2]
      );
      // The orbit controls pan up operation is tied to the z dimension
      camera.up = new THREE.Vector3(0, 0, 1);
      camera.lookAt(target);
      camera.zoom = cameraDef.zoom;
      camera.updateProjectionMatrix();
    }
    this.camera = camera;
    this.makeOrbitControls(camera, false);
  }

  private makeDefaultCameraDef(
    dimensions: number,
    cameraParams: CameraParams = {}
  ): CameraDef {
    const orthographic = dimensions === 2;
    const position = orthographic ? START_CAMERA_POS_2D : START_CAMERA_POS_3D;
    const target = orthographic
      ? START_CAMERA_TARGET_2D
      : START_CAMERA_TARGET_3D;
    const def: CameraDef = {
      orthographic,
      zoom: 1.0,
      position: [position.x, position.y, position.z],
      target: [target.x, target.y, target.z],
    };

    if (cameraParams.zoom) def.zoom = cameraParams.zoom;
    if (cameraParams.position) def.position = cameraParams.position;
    if (cameraParams.target) def.target = cameraParams.target;

    return def;
  }

  /** Recreate the scatter plot camera from a definition structure. */
  recreateCamera(cameraDef: CameraDef) {
    if (cameraDef.orthographic) {
      this.makeCamera2D(cameraDef, this.width, this.height);
    } else {
      this.makeCamera3D(cameraDef, this.width, this.height);
    }
    this.orbitCameraControls.minDistance = MIN_ZOOM;
    this.orbitCameraControls.maxDistance = MAX_ZOOM;
    this.orbitCameraControls.update();
    if (this.orbitAnimationOnNextCameraCreation) {
      this.startOrbitAnimation();
    }
  }

  setInteractionMode(interactionMode: InteractionMode) {
    this.interactionMode = interactionMode;
    if (interactionMode === InteractionMode.SELECT) {
      this.selecting = true;
      this.container.style.cursor = 'crosshair';
    } else {
      this.selecting = false;
      this.container.style.cursor = 'default';
    }
  }

  private onClick(e: MouseEvent | null, notify = true) {
    if (e && this.selecting) {
      return;
    }
    // Only call event handlers if the click originated from the scatter plot.
    if (!this.isDragSequence && notify) {
      const selection = this.nearestPoint != null ? [this.nearestPoint] : [];
      this.selectCallback(selection);
      this.clickCallback(this.nearestPoint);
    }
    this.isDragSequence = false;
    this.render();
  }

  private onMouseDown(e: MouseEvent) {
    this.isDragSequence = false;
    this.mouseIsDown = true;
    if (this.selecting) {
      this.orbitCameraControls.enabled = false;
      this.rectangleSelector.onMouseDown(e.offsetX, e.offsetY);
      this.setNearestPointToMouse(e);
    } else if (
      !e.ctrlKey &&
      this.sceneIs3D() &&
      this.orbitCameraControls.mouseButtons.ORBIT === THREE.MOUSE.RIGHT
    ) {
      // The user happened to press the ctrl key when the tab was active,
      // unpressed the ctrl when the tab was inactive, and now he/she
      // is back to the projector tab.
      this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.LEFT;
      this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.RIGHT;
    } else if (
      e.ctrlKey &&
      this.sceneIs3D() &&
      this.orbitCameraControls.mouseButtons.ORBIT === THREE.MOUSE.LEFT
    ) {
      // Similarly to the situation above.
      this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.RIGHT;
      this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.LEFT;
    }
  }

  /** When we stop dragging/zooming, return to normal behavior. */
  private onMouseUp(e: any) {
    if (this.selecting) {
      this.orbitCameraControls.enabled = true;
      this.rectangleSelector.onMouseUp();
      this.render();
    }
    this.mouseIsDown = false;
  }

  private lastHovered: number | null = null;
  /**
   * When the mouse moves, find the nearest point (if any) and send it to the
   * hoverlisteners (usually called from embedding.ts)
   */
  private onMouseMove(e: MouseEvent) {
    this.isDragSequence = this.mouseIsDown;
    // Depending if we're selecting or just navigating, handle accordingly.
    if (this.selecting && this.mouseIsDown) {
      this.rectangleSelector.onMouseMove(e.offsetX, e.offsetY);
      this.render();
    } else if (!this.mouseIsDown) {
      this.setNearestPointToMouse(e);
      if (this.nearestPoint != this.lastHovered) {
        this.lastHovered = this.nearestPoint;
        this.hoverCallback(this.nearestPoint);
      }
    }
  }

  /** For using ctrl + left click as right click, and for circle select */
  private onKeyDown(e: KeyboardEvent) {
    // If ctrl is pressed, use left click to orbit
    if (e.keyCode === CTRL_KEY && this.sceneIs3D()) {
      this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.RIGHT;
      this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.LEFT;
    }

    // If shift is pressed, start selecting
    if (e.keyCode === SHIFT_KEY && this.selectEnabled) {
      this.selecting = true;
      this.container.style.cursor = 'crosshair';
    }
  }

  /** For using ctrl + left click as right click, and for circle select */
  private onKeyUp(e: KeyboardEvent) {
    if (e.keyCode === CTRL_KEY && this.sceneIs3D()) {
      this.orbitCameraControls.mouseButtons.ORBIT = THREE.MOUSE.LEFT;
      this.orbitCameraControls.mouseButtons.PAN = THREE.MOUSE.RIGHT;
    }

    // If shift is released, stop selecting
    if (e.keyCode === SHIFT_KEY && this.selectEnabled) {
      this.selecting = false;
      this.container.style.cursor = 'default';
      this.render();
    }
  }

  /**
   * Returns a list of indices of points in a bounding box by manually
   * projecting those points into camera space. This is less efficient than the
   * picking texture approach, but the picking texture approach has issues with
   * fully occluded points being left out (for instance when selecting many
   * points while very zoomed out)
   *
   * @param boundingBox The bounding box to select from.
   */
  private getPointIndicesFromBoundingBox(boundingBox: ScatterBoundingBox) {
    if (this.worldSpacePointPositions == null) {
      return [];
    }
    this.camera.updateMatrixWorld();

    const dpr = window.devicePixelRatio || 1;
    const selectionX = Math.floor(boundingBox.x * dpr);
    const selectionY = Math.floor(boundingBox.y * dpr);
    const selectionWidth = Math.max(Math.floor(boundingBox.width * dpr), 1);
    const selectionHeight = Math.max(Math.floor(boundingBox.height * dpr), 1);

    // If the bounding box is size 2 or less (indicating a click with the
    // selection tool enabled), then we'll use the more efficient and forgiving
    // picking texture approach.
    if (selectionWidth <= 2 && selectionHeight <= 2) {
      return this.getPointIndicesFromBoundingBoxPickingTexture(boundingBox);
    }

    const canvas = this.renderer.domElement;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    let pointIndices: number[] = [];
    // Reuse the same Vector3 to avoid unnecessary allocations.
    const vector3 = new THREE.Vector3();
    for (let i = 0; i < this.worldSpacePointPositions.length; i++) {
      const start = i * 3;
      const [worldX, worldY, worldZ] = this.worldSpacePointPositions.slice(
        start,
        start + 3
      );
      vector3.x = worldX;
      vector3.y = worldY;
      vector3.z = worldZ;
      const screenVector = vector3.project(this.camera);
      const x = ((screenVector.x + 1) * canvasWidth) / 2;
      const y = (-(screenVector.y - 1) * canvasHeight) / 2;

      if (x >= selectionX && x <= selectionX + selectionWidth) {
        if (y <= selectionY && y >= selectionY - selectionHeight) {
          pointIndices.push(i);
        }
      }
    }

    return pointIndices;
  }

  /**
   * Returns a list of indices of points in a bounding box from the picking
   * texture.
   * @param boundingBox The bounding box to select from.
   */
  private getPointIndicesFromBoundingBoxPickingTexture(
    boundingBox: ScatterBoundingBox
  ): number[] {
    if (this.worldSpacePointPositions == null) {
      return [];
    }

    const pointCount = this.worldSpacePointPositions.length / 3;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.floor(boundingBox.x * dpr);
    const y = Math.floor(boundingBox.y * dpr);
    const width = Math.max(Math.floor(boundingBox.width * dpr), 1);
    const height = Math.max(Math.floor(boundingBox.height * dpr), 1);

    // Create buffer for reading all of the pixels from the texture.
    let pixelBuffer = new Uint8Array(width * height * 4);

    // Read the pixels from the bounding box.
    this.renderer.readRenderTargetPixels(
      this.pickingTexture,
      x,
      this.pickingTexture.height - y,
      width,
      height,
      pixelBuffer
    );

    // Keep a flat list of each point and whether they are selected or not. This
    // approach is more efficient than using an object keyed by the index.
    let pointIndicesSelection = new Uint8Array(
      this.worldSpacePointPositions.length
    );
    for (let i = 0; i < width * height; i++) {
      const id =
        (pixelBuffer[i * 4] << 16) |
        (pixelBuffer[i * 4 + 1] << 8) |
        pixelBuffer[i * 4 + 2];
      if (id !== 0xffffff && id < pointCount) {
        pointIndicesSelection[id] = 1;
      }
    }
    let pointIndices: number[] = [];
    for (let i = 0; i < pointIndicesSelection.length; i++) {
      if (pointIndicesSelection[i] === 1) {
        pointIndices.push(i);
      }
    }

    return pointIndices;
  }

  private selectBoundingBox(boundingBox: ScatterBoundingBox) {
    let pointIndices = this.getPointIndicesFromBoundingBox(boundingBox);
    this.selectCallback(pointIndices);
  }

  private setNearestPointToMouse(e: MouseEvent) {
    if (this.pickingTexture == null) {
      this.nearestPoint = null;
      return;
    }

    const boundingBox: ScatterBoundingBox = {
      x: e.offsetX,
      y: e.offsetY,
      width: 1,
      height: 1,
    };

    const pointIndices = this.getPointIndicesFromBoundingBoxPickingTexture(
      boundingBox
    );
    this.nearestPoint = pointIndices.length ? pointIndices[0] : null;
  }

  private computeLayoutValues(): Point2D {
    this.width = this.container.offsetWidth;
    this.height = Math.max(1, this.container.offsetHeight);
    return [this.width, this.height];
  }

  private sceneIs3D(): boolean {
    return this.dimensions === 3;
  }

  private remove3dAxesFromScene(): THREE.Object3D | undefined {
    const axes = this.scene.getObjectByName('axes');
    if (axes != null) {
      this.scene.remove(axes);
    }
    return axes;
  }

  private add3dAxes() {
    const axes = new THREE.AxesHelper();
    axes.name = 'axes';
    this.scene.add(axes);
  }

  /** Set 2d vs 3d mode. */
  setDimensions(dimensions: number) {
    if (dimensions !== 2 && dimensions !== 3) {
      throw new RangeError('dimensions must be 2 or 3');
    }

    if (this.dimensions !== dimensions) {
      this.dimensions = dimensions;
      this.makeCamera();
    }
  }

  /** Gets the current camera position. */
  getCameraPosition(): Point3D {
    const currPos = this.camera.position;
    return [currPos.x, currPos.y, currPos.z];
  }

  /** Gets the current camera target. */
  getCameraTarget(): Point3D {
    let currTarget = this.orbitCameraControls.target;
    return [currTarget.x, currTarget.y, currTarget.z];
  }

  /** Sets up the camera from given position and target coordinates. */
  setCameraPositionAndTarget(position: Point3D, target: Point3D) {
    this.stopOrbitAnimation();
    this.camera.position.set(position[0], position[1], position[2]);
    this.orbitCameraControls.target.set(target[0], target[1], target[2]);
    this.orbitCameraControls.update();
    this.render();
  }

  /** Starts orbiting the camera around its current lookat target. */
  startOrbitAnimation() {
    if (!this.sceneIs3D()) {
      return;
    }
    if (this.orbitAnimationId != null) {
      this.stopOrbitAnimation();
    }
    this.orbitCameraControls.autoRotate = true;
    this.orbitCameraControls.autoRotateSpeed = this.orbitControlParams.autoRotateSpeed;
    this.updateOrbitAnimation();
  }

  orbitIsAnimating() {
    return this.orbitAnimationId != null;
  }

  private updateOrbitAnimation() {
    this.orbitCameraControls.update();
    this.orbitAnimationId = requestAnimationFrame(() =>
      this.updateOrbitAnimation()
    );
  }

  /** Stops the orbiting animation on the camera. */
  stopOrbitAnimation() {
    this.orbitCameraControls.autoRotate = false;
    this.orbitCameraControls.rotateSpeed = this.orbitControlParams.mouseRotateSpeed;
    if (this.orbitAnimationId != null) {
      cancelAnimationFrame(this.orbitAnimationId);
      this.orbitAnimationId = null;
    }
  }

  setActiveVisualizers(visualizers: ScatterPlotVisualizer[]) {
    const nextVisualizerIds = new Set<string>(visualizers.map(v => v.id));
    for (const visualizer of this.visualizers.values()) {
      if (!nextVisualizerIds.has(visualizer.id)) {
        visualizer.dispose();
        this.visualizers.delete(visualizer.id);
      }
    }

    for (const visualizer of visualizers) {
      this.visualizers.set(visualizer.id, visualizer);
      visualizer.setScene(this.scene);
      visualizer.onResize(this.width, this.height);
      if (this.worldSpacePointPositions) {
        visualizer.onPointPositionsChanged(this.worldSpacePointPositions);
      }
    }
  }

  /** Disposes all visualizers attached to this scatter plot. */
  disposeAllVisualizers() {
    this.visualizers.forEach(v => v.dispose());
    this.visualizers.clear();
  }

  /** Update scatter plot with a new array of packed xyz point positions. */
  setPointPositions(worldSpacePointPositions: Float32Array) {
    this.worldSpacePointPositions = worldSpacePointPositions;
    this.visualizers.forEach(v =>
      v.onPointPositionsChanged(worldSpacePointPositions)
    );
  }

  render() {
    {
      const lightPos = this.camera.position.clone();
      lightPos.x += 1;
      lightPos.y += 1;
      this.light.position.set(lightPos.x, lightPos.y, lightPos.z);
    }

    const cameraType =
      this.camera instanceof THREE.PerspectiveCamera
        ? CameraType.Perspective
        : CameraType.Orthographic;

    let cameraSpacePointExtents: [number, number] = [0, 0];
    if (this.worldSpacePointPositions != null) {
      cameraSpacePointExtents = util.getNearFarPoints(
        this.worldSpacePointPositions,
        this.camera.position,
        this.orbitCameraControls.target
      );
    }

    const rc = new RenderContext(
      this.camera,
      cameraType,
      this.orbitCameraControls.target,
      this.width,
      this.height,
      cameraSpacePointExtents[0],
      cameraSpacePointExtents[1],
      this.styles.backgroundColor,
      this.pointColors,
      this.pointScaleFactors,
      this.labels,
      this.polylineColors,
      this.polylineOpacities,
      this.polylineWidths
    );

    // Render first pass to picking target. This render fills pickingTexture
    // with colors that are actually point ids, so that sampling the texture at
    // the mouse's current x,y coordinates will reveal the data point that the
    // mouse is over.
    this.visualizers.forEach(v => v.onPickingRender(rc));

    {
      const axes = this.remove3dAxesFromScene();
      this.renderer.setRenderTarget(this.pickingTexture);
      this.renderer.render(this.scene, this.camera);
      if (axes != null) {
        this.scene.add(axes);
      }
    }

    // Render second pass to color buffer, to be displayed on the canvas.
    this.visualizers.forEach(v => v.onRender(rc));

    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  /** Set the colors for every data point. (RGB triplets) */
  setPointColors(colors: Float32Array) {
    this.pointColors = colors;
  }

  /** Set the scale factors for every data point. (scalars) */
  setPointScaleFactors(scaleFactors: Float32Array) {
    this.pointScaleFactors = scaleFactors;
  }

  /** Set the labels to rendered */
  setLabels(labels: LabelRenderParams) {
    this.labels = labels;
  }

  /** Set the colors for every data polyline. (RGB triplets) */
  setPolylineColors(colors: {[polylineIndex: number]: Float32Array}) {
    this.polylineColors = colors;
  }

  setPolylineOpacities(opacities: Float32Array) {
    this.polylineOpacities = opacities;
  }

  setPolylineWidths(widths: Float32Array) {
    this.polylineWidths = widths;
  }

  resetZoom() {
    this.recreateCamera(this.makeDefaultCameraDef(this.dimensions));
    this.render();
  }

  setDayNightMode(isNight: boolean) {
    const canvases = this.container.querySelectorAll('canvas');
    const filterValue = isNight ? 'invert(100%)' : '';
    for (let i = 0; i < canvases.length; i++) {
      canvases[i].style.filter = filterValue;
    }
  }

  resize(render = true) {
    const [oldW, oldH] = [this.width, this.height];
    const [newW, newH] = this.computeLayoutValues();

    if (this.dimensions === 3) {
      const camera = this.camera as THREE.PerspectiveCamera;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
    } else {
      const camera = this.camera as THREE.OrthographicCamera;
      // Scale the ortho frustum by however much the window changed.
      const scaleW = newW / oldW;
      const scaleH = newH / oldH;
      const newCamHalfWidth = ((camera.right - camera.left) * scaleW) / 2;
      const newCamHalfHeight = ((camera.top - camera.bottom) * scaleH) / 2;
      camera.top = newCamHalfHeight;
      camera.bottom = -newCamHalfHeight;
      camera.left = -newCamHalfWidth;
      camera.right = newCamHalfWidth;
      camera.updateProjectionMatrix();
    }

    // Accouting for retina displays.
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(newW, newH);

    // the picking texture needs to be exactly the same as the render texture.
    {
      const renderCanvasSize = new THREE.Vector2();
      this.renderer.getSize(renderCanvasSize);
      const pixelRatio = this.renderer.getPixelRatio();
      this.pickingTexture = new THREE.WebGLRenderTarget(
        renderCanvasSize.width * pixelRatio,
        renderCanvasSize.height * pixelRatio
      );
      this.pickingTexture.texture.minFilter = THREE.LinearFilter;
    }

    this.visualizers.forEach(v => v.onResize(newW, newH));

    if (render) {
      this.render();
    }
  }

  onCameraMove(listener: OnCameraMoveListener) {
    this.onCameraMoveListeners.push(listener);
  }

  clickOnPoint(pointIndex: number) {
    this.nearestPoint = pointIndex;
    this.onClick(null, false);
  }
}
