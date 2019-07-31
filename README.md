# Scatter Projector

Standalone 3D / 2D webgl-accelerated scatter plot point projector. Core functionality from the [embedding projector](http://projector.tensorflow.org), capable of rendering and interacting with tens of thousands of points.

## Examples

#### Basic use

```javascript
// An array of n-dimensional vectors
const points = vectors.map((vector, index) => {
  return { vector, index };
});
const dataset = new Dataset(points, nDimensions);

const projector = new Projector({
  containerElement,
  dataset,
});
```

#### Parameters

The Projector constructor can accept a number of parameters via a `ProjectorParams` object:

| Parameter           | Description                                                                                             | default            |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| `containerElement`  | The HTML Element that the projection will be rendered in                                                | **required**       |
| `dataset`           | The `Dataset` object, containing all of the data to be projected and associated metadata                | **required**       |
| `onHover`           | A callback invoked when hovering over a point                                                           |                    |
| `onSelect`          | A callback invoked when a point or points are selected                                                  |                    |
| `pointColorer`      | A function to determine the color of points                                                             |                    |
| `renderMode`        | The render mode to display points, one of `RenderMode.POINT`, `RenderMode.SPRITE`, or `RenderMode.TEXT` | `RenderMode.POINT` |
| `showLabelsOnHover` | Whether or not to render label text on hover                                                            | true               |
| `styles`            | An object containing style parameters to override the default options                                   |                    |

## Advanced usage

See the [demo app](./demo/index.ts) for examples of interaction handling, spritesheet rendering, and point coloring.

## Development

```bash
yarn
yarn demo
```

**This is not an officially supported Google product**
