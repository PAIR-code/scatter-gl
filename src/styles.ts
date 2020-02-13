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

export type Color = string;

export interface LabelStyles {
  fontSize: number;
  scaleDefault: number;
  scaleLarge: number;
  fillColorSelected: Color;
  fillColorHover: Color;
  strokeColorSelected: Color;
  strokeColorHover: Color;
  strokeWidth: number;
  fillWidth: number;
}

export interface Label3DStyles {
  fontSize: number;
  scale: number;
  color: Color;
  backgroundColor: Color;
  colorUnselected: Color;
  colorNoSelection: Color;
}

export interface PointStyles {
  colorUnselected: Color;
  colorNoSelection: Color;
  colorSelected: Color;
  colorHover: Color;
  scaleDefault: number;
  scaleSelected: number;
  scaleHover: number;
}

export interface FogStyles {
  color: Color;
  enabled: boolean;
  threshold: number;
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
  fill: Color;
  fillOpacity: number;
  stroke: Color;
  strokeWidth: number;
  strokeDashArray: string;
}

export interface SpritesStyles {
  minPointSize: number;
  imageSize: number;
  colorUnselected: Color;
  colorNoSelection: Color;
}

export interface Styles {
  backgroundColor: Color;
  axesVisible: boolean;
  fog: FogStyles;
  label: LabelStyles;
  label3D: Label3DStyles;
  point: PointStyles;
  polyline: PolylineStyles;
  select: SelectStyles;
  sprites: SpritesStyles;
}

export interface UserStyles {
  backgroundColor?: number;
  axesVisible?: boolean;
  fog?: Partial<FogStyles>;
  label?: Partial<LabelStyles>;
  label3D?: Partial<Label3DStyles>;
  point?: Partial<PointStyles>;
  polyline?: Partial<PolylineStyles>;
  select?: Partial<SelectStyles>;
  sprites?: Partial<SpritesStyles>;
}

const makeDefaultStyles = () => {
  const defaultStyles: Styles = {
    backgroundColor: '#ffffff',
    axesVisible: true,

    fog: {
      color: '#ffffff',
      enabled: true,
      threshold: 5000,
    },

    label: {
      fontSize: 10,
      scaleDefault: 1,
      scaleLarge: 2,
      fillColorSelected: '#000000',
      fillColorHover: '#000000',
      strokeColorSelected: '#ffffff',
      strokeColorHover: '#ffffff',
      strokeWidth: 3,
      fillWidth: 6,
    },

    label3D: {
      fontSize: 80,
      scale: 2.2, // at 1:1 texel/pixel ratio
      color: 'black',
      backgroundColor: '#ffffff',
      colorUnselected: '#ffffff',
      colorNoSelection: '#ffffff',
    },

    point: {
      colorUnselected: 'rgba(227, 227, 227, 0.7)',
      colorNoSelection: 'rgba(117, 117, 217, 0.7)',
      colorSelected: 'rgba(250, 102, 102, 0.7)',
      colorHover: 'rgba(118, 11, 79, 0.7)',
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
      minPointSize: 5.0,
      imageSize: 30,
      colorUnselected: '#ffffff',
      colorNoSelection: '#ffffff',
    },
  };
  return defaultStyles;
};

/**
 * Merge default styles with user-supplied styles object.
 */
export function makeStyles(userStyles: UserStyles | undefined) {
  const defaultStyles = makeDefaultStyles();

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
