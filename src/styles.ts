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

export interface LabelStyles {
  fontSize: number;
  scaleDefault: number;
  scaleLarge: number;
  fillColorSelected: number;
  fillColorHover: number;
  strokeColorSelected: number;
  strokeColorHover: number;
  strokeWidth: number;
  fillWidth: number;
}

export interface Label3DStyles {
  fontSize: number;
  scale: number;
  color: string;
  backgroundColor: string;
  colorUnselected: number;
  colorNoSelection: number;
}

export interface PointStyles {
  colorUnselected: number;
  colorNoSelection: number;
  colorSelected: number;
  colorHover: number;
  scaleDefault: number;
  scaleSelected: number;
  scaleHover: number;
}

export interface PolylineStyles {
  startHue: number;
  endHue: number;
  saturation: number;
  lightness: number;
  defaultOpacity: number;
  defaultLineWidth: number;
  selectedOpacity: number;
  selectedLineWidth: number;
  deselectedOpacity: number;
}

export interface SelectStyles {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeDashArray: string;
}

export interface SpritesStyles {
  numPointsFogThreshold: number;
  minPointSize: number;
  imageSize: number;
  colorUnselected: number;
  colorNoSelection: number;
}

export interface Styles {
  backgroundColor: number;
  label: LabelStyles;
  label3D: Label3DStyles;
  point: PointStyles;
  polyline: PolylineStyles;
  select: SelectStyles;
  sprites: SpritesStyles;
}

export interface UserStyles {
  backgroundColor?: number;
  label: Partial<LabelStyles>;
  label3D: Partial<Label3DStyles>;
  point: Partial<PointStyles>;
  polyline: Partial<PolylineStyles>;
  select: Partial<SelectStyles>;
  sprites: Partial<SpritesStyles>;
}

const defaultStyles: Styles = {
  backgroundColor: 0xffffff,

  label: {
    fontSize: 10,
    scaleDefault: 1,
    scaleLarge: 2,
    fillColorSelected: 0x000000,
    fillColorHover: 0x000000,
    strokeColorSelected: 0xffffff,
    strokeColorHover: 0xffffff,
    strokeWidth: 3,
    fillWidth: 6,
  },

  label3D: {
    fontSize: 80,
    scale: 2.2, // at 1:1 texel/pixel ratio
    color: 'black',
    backgroundColor: 'white',
    colorUnselected: 0xffffff,
    colorNoSelection: 0xffffff,
  },

  point: {
    colorUnselected: 0xe3e3e3,
    colorNoSelection: 0x7575d9,
    colorSelected: 0xfa6666,
    colorHover: 0x760b4f,
    scaleDefault: 1.0,
    scaleSelected: 1.2,
    scaleHover: 1.2,
  },

  polyline: {
    startHue: 60,
    endHue: 360,
    saturation: 1,
    lightness: 0.3,
    defaultOpacity: 0.2,
    defaultLineWidth: 2,
    selectedOpacity: 0.9,
    selectedLineWidth: 3,
    deselectedOpacity: 0.05,
  },

  select: {
    fill: '#dddddd',
    fillOpacity: 0.2,
    stroke: '#aaaaaa',
    strokeWidth: 2,
    strokeDashArray: '10 5',
  },

  sprites: {
    numPointsFogThreshold: 5000,
    minPointSize: 5.0,
    imageSize: 30,
    colorUnselected: 0xffffff,
    colorNoSelection: 0xffffff,
  },
};

/**
 * Merge default styles with user-supplied styles object.
 */
export function makeStyles(userStyles: UserStyles | undefined) {
  if (userStyles === undefined) {
    return defaultStyles;
  }
  for (let key in defaultStyles) {
    const _key = key as keyof Styles;
    if (
      typeof defaultStyles[_key] === 'object' &&
      typeof userStyles[_key] === 'object'
    ) {
      (defaultStyles[_key] as any) = Object.assign(
        defaultStyles[_key],
        userStyles[_key]
      );
    } else if (userStyles[_key] !== undefined) {
      (defaultStyles[_key] as any) = userStyles[_key];
    }
  }
  return defaultStyles;
}
