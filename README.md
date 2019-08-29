# ScatterGL

Standalone 3D / 2D webgl-accelerated scatter plot point projector. Core functionality from the [embedding projector](http://projector.tensorflow.org), capable of rendering and interacting with tens of thousands of points.

## Examples

#### Basic use

```javascript
// where `points` is an array of 2 or 3-dimensional points as number arrays.
const dataset = new Dataset(points, nDimensions);

const scatterGL = new ScatterGL({
  containerElement,
  dataset,
});
```

#### Parameters

The `ScatterGL` constructor can accept a number of parameters via a `ScatterGLParams` object:

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
| `rotateOnStart`     | Whether or not the renderer automatically rotates until interaction                                     | true               |

#### ScatterGL methods

| Method                      | Description                                            |
| --------------------------- | ------------------------------------------------------ |
| `setRenderMode(renderMode)` | Sets a specific render mode                            |
| `setPointRenderMode`        | Sets point render mode                                 |
| `setSpriteRenderMode`       | Sets sprite render mode                                |
| `setTextRenderMode`         | Sets text render mode                                  |
| `setPanMode`                | Sets interaction mode to 'pan'                         |
| `setSelectMode`             | Sets interaction mode to 'select'                      |
| `setPointColorer`           | Sets a function to determin colors                     |
| `resize`                    | Updates the render size based on the container element |
| `updateDataset(dataset)`    | Updates the dataset                                    |
| `startOrbitAnimation`       | Begin rotating until an interaction                    |

## Advanced usage

See the [demo app](./demo/index.ts) for examples of interaction handling, spritesheet rendering, and point coloring.

## Styling

You can provide an object in the form of [`Styles`](./src/styles.ts) to the

## Development

```bash
yarn
yarn demo
```

**This is not an officially supported Google product**
