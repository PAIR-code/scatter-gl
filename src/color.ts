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

export interface Color {
  r: number;
  g: number;
  b: number;
  opacity: number;
}

const cache = new Map<string, Color>();

const regex = /^(rgba|hsla)\((\d+),\s*(\d+%?),\s*(\d+%?)(?:,\s*(\d+(?:\.\d+)?))?\)$/;

function parseOpacity(colorString: string) {
  const result = regex.exec(colorString);
  if (result) {
    const [_, rgbaOrHsla, rh, gs, bl, opacity] = result;
    const colorString = `${rgbaOrHsla.replace('a', '')}(${rh},${gs},${bl})`;
    return {colorString, opacity: parseFloat(opacity)};
  }
  return {colorString, opacity: 1};
}

export function parseColor(inputColorString: string): Color {
  if (cache.has(inputColorString)) return cache.get(inputColorString)!;
  const {colorString, opacity} = parseOpacity(inputColorString);
  const color = new THREE.Color(colorString);
  const {r, g, b} = color;
  const item = {r, g, b, opacity};
  cache.set(inputColorString, item);
  return item;
}
