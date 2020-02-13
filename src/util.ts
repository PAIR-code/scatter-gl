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
import {Point2D} from './types';

/** Projects a 3d point into screen space */
export function vector3DToScreenCoords(
  cam: THREE.Camera,
  w: number,
  h: number,
  v: THREE.Vector3
): Point2D {
  let dpr = window.devicePixelRatio;
  let pv = new THREE.Vector3().copy(v).project(cam);

  // The screen-space origin is at the middle of the screen, with +y up.
  let coords: Point2D = [
    ((pv.x + 1) / 2) * w * dpr,
    -(((pv.y - 1) / 2) * h) * dpr,
  ];
  return coords;
}

/** Loads 3 contiguous elements from a packed xyz array into a Vector3. */
export function vector3FromPackedArray(
  a: Float32Array,
  pointIndex: number
): THREE.Vector3 {
  const offset = pointIndex * 3;
  return new THREE.Vector3(a[offset], a[offset + 1], a[offset + 2]);
}

/**
 * Gets the camera-space z coordinates of the nearest and farthest points.
 * Ignores points that are behind the camera.
 */
export function getNearFarPoints(
  worldSpacePoints: Float32Array,
  cameraPos: THREE.Vector3,
  cameraTarget: THREE.Vector3
): [number, number] {
  let shortestDist: number = Infinity;
  let furthestDist: number = 0;
  const camToTarget = new THREE.Vector3().copy(cameraTarget).sub(cameraPos);
  const camPlaneNormal = new THREE.Vector3().copy(camToTarget).normalize();
  const n = worldSpacePoints.length / 3;
  let src = 0;
  let p = new THREE.Vector3();
  let camToPoint = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.x = worldSpacePoints[src];
    p.y = worldSpacePoints[src + 1];
    p.z = worldSpacePoints[src + 2];
    src += 3;

    camToPoint.copy(p).sub(cameraPos);
    const dist = camPlaneNormal.dot(camToPoint);
    if (dist < 0) {
      continue;
    }
    furthestDist = dist > furthestDist ? dist : furthestDist;
    shortestDist = dist < shortestDist ? dist : shortestDist;
  }
  return [shortestDist, furthestDist];
}

function prepareTexture(
  texture: THREE.Texture,
  needsUpdate = true
): THREE.Texture {
  texture.needsUpdate = needsUpdate;
  // Used if the texture isn't a power of 2.
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  return texture;
}

/**
 * Generate a texture from a canvas and sets some initial params
 */
export function createTextureFromCanvas(
  image: HTMLCanvasElement
): THREE.Texture {
  const texture = new THREE.Texture(image);
  return prepareTexture(texture);
}

/**
 * Generate a texture from an image and sets some initial params
 */
export function createTextureFromImage(
  image: HTMLImageElement,
  onImageLoad: () => void
): THREE.Texture {
  const texture = new THREE.Texture(image);
  image.onload = () => {
    texture.needsUpdate = true;
    onImageLoad();
  };
  return prepareTexture(texture, false);
}

/** Checks to see if the browser supports webgl. */
export function hasWebGLSupport(): boolean {
  try {
    let c = document.createElement('canvas');
    let gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    return gl != null;
  } catch (e) {
    return false;
  }
}

/** Compute the extent [minimum, maximum] of an array of numbers. */
export function extent(data: number[]) {
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item < minimum) minimum = item;
    if (item > maximum) maximum = item;
  }
  return [minimum, maximum];
}

/** Scale a value linearly within a domain and range */
export function scaleLinear(value: number, domain: number[], range: number[]) {
  const domainDifference = domain[1] - domain[0];
  const rangeDifference = range[1] - range[0];

  const percentDomain = (value - domain[0]) / domainDifference;
  return percentDomain * rangeDifference + range[0];
}

/** Scale a value exponentially within a domain and range */
export function scaleExponential(
  value: number,
  domain: number[],
  range: number[]
) {
  const domainDifference = domain[1] ** Math.E - domain[0] ** Math.E;
  const rangeDifference = range[1] - range[0];

  const percentDomain = (value ** Math.E - domain[0]) / domainDifference;
  return percentDomain * rangeDifference + range[0];
}

export function packRgbIntoUint8Array(
  rgbArray: Uint8Array,
  labelIndex: number,
  r: number,
  g: number,
  b: number
) {
  rgbArray[labelIndex * 3] = r;
  rgbArray[labelIndex * 3 + 1] = g;
  rgbArray[labelIndex * 3 + 2] = b;
}

export function styleRgbFromHexColor(
  hex: number | string
): [number, number, number] {
  const c = new THREE.Color(hex as string);
  return [(c.r * 255) | 0, (c.g * 255) | 0, (c.b * 255) | 0];
}

const toPercent = (percent: number) => `${100 * percent}%`;

export function getDefaultPointInPolylineColor(
  index: number,
  totalPoints: number,
  startHue: number,
  endHue: number,
  saturation: number,
  lightness: number
): THREE.Color {
  let hue = startHue + ((endHue - startHue) * index) / totalPoints;

  const hsl = `hsl(${hue}, ${toPercent(saturation)}, ${toPercent(lightness)})`;
  return new THREE.Color(hsl);
}
