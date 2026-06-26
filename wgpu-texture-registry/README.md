# wgpu-texture-registry
WGPU Texture Registry is a helper to help you make a 2d-array or cube-array in WebGPU easily.

# Usage
```ts
import {D2DTextureRegistry} from "@cosmos-js/wgpu-texture-registry";
const registry = new D2DTextureRegistry({label: "My texture array", size: {width: 16, height: 16}});
const dirtId = registry.register(myImage);
const texture = registry.texture;
```