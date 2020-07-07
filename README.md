# ScatterGL

Interactive 3D / 2D webgl-accelerated scatter plot point renderer. Core functionality from the [embedding projector](http://projector.tensorflow.org), capable of rendering and interacting with tens of thousands of points.

## Examples

#### Basic use

```javascript
// where `points` is an array of 2 or 3-dimensional points as number arrays.
const dataset = new ScatterGL.Dataset(points);
const scatterGL = new ScatterGL(containerElement);
scatterGL.render(dataset);
```

## Installation

##### with yarn / npm

```bash
yarn add scatter-gl
```

##### via cdn

```html
<!-- Load three.js -->
<script src="https://cdn.jsdelivr.net/npm/three@0.106.2/build/three.min.js"></script>
<!-- Load scatter-gl.js -->
<script src="https://cdn.jsdelivr.net/npm/scatter-gl@0.0.1/lib/scatter-gl.min.js"></script>
```

#### Parameters

The `ScatterGL` constructor can accept a number of parameters via a `ScatterGLParams` object:

| Parameter           | Type                                                                               | Description                                                                                             | default                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `camera`            | `Camera`                                                                           | An object containing default parameters for the camera                                                  | Camera params object (`zoom: number`, `target: Point3D`, and `position: Point3D`)                             |
| `onClick`           | `(point: Point \| null) => void`                                                   | A callback invoked when clicking on a point or elsewhere                                                |                                                                                                               |
| `onHover`           | `(point: Point \| null) => void`                                                   | A callback invoked when hovering over a point                                                           |                                                                                                               |
| `onSelect`          | `(points: Point[]) => void`                                                        | A callback invoked when a point or points are selected                                                  |                                                                                                               |
| `onCameraMove`      | `(cameraPosition: THREE.Vector3, cameraTarget: THREE.Vector3) => void`             | A callback invoked the camera moves due to user interaction.                                            |                                                                                                               |
| `pointColorer`      | `(index: number, selectedIndices: Set<number>, hoverIndex: number|null) => string` | A function to determine the color of points                                                             |                                                                                                               |
| `renderMode`        | `RenderMode`                                                                       | The render mode to display points, one of `RenderMode.POINT`, `RenderMode.SPRITE`, or `RenderMode.TEXT` | `RenderMode.POINT`                                                                                            |
| `showLabelsOnHover` | `boolean`                                                                          | Whether or not to render label text on hover                                                            | `true`                                                                                                        |
| `selectEnabled`     | `boolean`                                                                          | `true`                                                                                                  | Whether or not a user can select points by clicking                                                           |
| `styles`            | `Styles`                                                                           | An object containing style parameters to override the default options                                   |                                                                                                               |
| `rotateOnStart`     | `boolean`                                                                          | Whether or not the renderer automatically rotates until interaction                                     | `true`                                                                                                        |
| `orbitControls`     | `OrbitControlParams`                                                               | An object containing default parameters for the orbit controls                                          | Orbit Controls params object (`zoomSpeed: number`, `autoRotateSpeed: number`, and `mouseRotateSpeed: number`) |

#### ScatterGL methods

| Method                                        | Description                                                |
| --------------------------------------------- | ---------------------------------------------------------- |
| `isOrbiting()`                                | Returns whether the orbit animation is currently on        |
| `render(dataset: Dataset)`                    | Initializes and renders a dataset to the container element |
| `resize()`                                    | Updates the render size based on the container element     |
| `select(pointIndices: number[])`              | Selects points by index                                    |
| `setPanMode()`                                | Sets interaction mode to 'pan'                             |
| `setPointColorer(pointColorer: PointColorer)` | Sets a function to determine colors                        |
| `setHoverPointIndex()`                        | Sets the hovered point                                     |
| `setPointRenderMode()`                        | Sets point render mode                                     |
| `setRenderMode(renderMode: RenderMode)`       | Sets a specific render mode                                |
| `setSelectMode()`                             | Sets interaction mode to 'select'                          |
| `setSequences(sequences: Sequence[])`         | Sets sequences with which to render polylines              |
| `setSpriteRenderMode()`                       | Sets sprite render mode                                    |
| `setTextRenderMode()`                         | Sets text render mode                                      |
| `updateDataset(dataset: Dataset)`             | Updates the dataset                                        |
| `startOrbitAnimation()`                       | Begin rotating until an interaction                        |
| `stopOrbitAnimation()`                        | Stops automatic rotation                                   |

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
