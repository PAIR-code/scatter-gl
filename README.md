# ScatterGL

Standalone 3D / 2D webgl-accelerated scatter plot point projector. Core functionality from the [embedding projector](http://projector.tensorflow.org), capable of rendering and interacting with tens of thousands of points.

## Examples

#### Basic use

```javascript
// where `points` is an array of 2 or 3-dimensional points as number arrays.
const dataset = new Dataset(points);
const scatterGL = new ScatterGL(containerElement, dataset, params);
```

#### Parameters

The `ScatterGL` constructor can accept a number of parameters via a `ScatterGLParams` object:

| Parameter           | Type                             | Description                                                                                             | default            |
| ------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------ |
| `onHover`           | `(point: Point \| null) => void` | A callback invoked when hovering over a point                                                           |                    |
| `onSelect`          | `(points: Point[]) => void`      | A callback invoked when a point or points are selected                                                  |                    |
| `pointColorer`      | `(point: Point) => string`       | A function to determine the color of points                                                             |                    |
| `renderMode`        | `RenderMode`                     | The render mode to display points, one of `RenderMode.POINT`, `RenderMode.SPRITE`, or `RenderMode.TEXT` | `RenderMode.POINT` |
| `showLabelsOnHover` | `boolean`                        | Whether or not to render label text on hover                                                            | `true`             |
| `styles`            | `Styles`                         | An object containing style parameters to override the default options                                   |                    |
| `rotateOnStart`     | `boolean`                        | Whether or not the renderer automatically rotates until interaction                                     | `true`             |

#### ScatterGL methods

| Method                                        | Description                                            |
| --------------------------------------------- | ------------------------------------------------------ |
| `setRenderMode(renderMode: RenderMode)`       | Sets a specific render mode                            |
| `setPointRenderMode()`                        | Sets point render mode                                 |
| `setSpriteRenderMode()`                       | Sets sprite render mode                                |
| `setTextRenderMode()`                         | Sets text render mode                                  |
| `setPanMode()`                                | Sets interaction mode to 'pan'                         |
| `setSelectMode()`                             | Sets interaction mode to 'select'                      |
| `setPointColorer(pointColorer: PointColorer)` | Sets a function to determin colors                     |
| `resize()`                                    | Updates the render size based on the container element |
| `updateDataset(dataset: Dataset)`             | Updates the dataset                                    |
| `startOrbitAnimation()`                       | Begin rotating until an interaction                    |

## Advanced usage

See the [demo app](./demo/index.ts) for examples of interaction handling, spritesheet rendering, and point coloring.

## Styling

You can provide an object in the form of [`Styles`](./src/styles.ts) via the `styles` parameter of the `ScatterGLParams` object.

## Development

```bash
yarn
yarn demo
```

**This is not an officially supported Google product**
