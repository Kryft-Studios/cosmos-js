# @cosmos-js/core

**Cosmos.js** is a powerful abstraction over **WebGPU** which aims to make the engine really customizable, while keeping things simple.

# Boilerplate

```js
import { Cosmos } from "@cosmos-js/core";
const canvas = document.getElementById("my-canvas");
const eo = await Cosmos.EngineObject.get(canvas, { performance: "high" });
const cos = new Cosmos(eo);

const vertices = new Float32Array([
  -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1, -1, -1, -1, 1, -1, -1, 1, 1, -1, -1,
  1, -1,
]);

const indices = new Uint16Array([
  0, 1, 2, 0, 2, 3, 1, 5, 6, 1, 6, 2, 5, 4, 7, 5, 7, 6, 4, 0, 3, 4, 3, 7, 3, 2,
  6, 3, 6, 7, 4, 5, 1, 4, 1, 0,
]);

const gpuObjectManager = new cos.DynamicGPUObjectManager(
  {
    vertices: { type: "GPUBuffer" },
    indices: { type: "GPUBuffer" },
    pipeline: { type: "GPURenderPipeline" },
  },
  (device) => {
    const v = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(v, 0, vertices);
    const i = device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(i, 0, indices);
    const sm = device.createShaderModule({
      code: `
struct VSOut {
  @builtin(position) pos: vec4f
};

@vertex
fn vs(@location(0) pos: vec3f) -> VSOut {
  var out: VSOut;
  out.pos = vec4f(pos, 1.0);
  return out;
}

@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(0.2, 0.8, 1.0, 1.0);
}
`,
    });

    const p = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: sm,
        entryPoint: "vs",
        buffers: [
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
          },
        ],
      },
      fragment: {
        module: sm,
        entryPoint: "fs",
        targets: [{ format: "bgra8unorm" }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
    return { pipeline: p, vertices: v, indices: i };
  },
);
gpuObjectManager.init();
const dynamicRI = new cosmos.DynamicRenderInstructions("Render", (enc) => {
  enc.begin({
    colorAttachments: [
      {
        view: eo.canvasContext.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  })
  .pipeline(gpuObjectManager.get("pipeline"))
  .vertexBuffer(0, gpuObjectManager.get("vertices"))
  .indexBuffer(gpuObjectManager.get("indices"))
  .drawIndexed(indices.length)
});
const dynpass = new cosmos.DynamicPass("MainPass", (renderer,computer)=>{
    renderer.render(dynamicRI)
})
function frame(){
cos.execDynSync(dynpass)
requestAnimationFrame(frame)
}
requestAnimationFrame(frame);
```
