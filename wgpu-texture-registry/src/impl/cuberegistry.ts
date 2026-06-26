







export interface CUBE_TEXTURE {
    px: ImageBitmap;
    nx: ImageBitmap;
    py: ImageBitmap;
    ny: ImageBitmap;
    pz: ImageBitmap;
    nz: ImageBitmap;
}
const IND_TO_TEXSIDE_LOOKUP = ["px", "nx", "py", "ny", "pz", "nz"]
/**@type {GPUTextureDescriptor[""]} */
export interface CUBE_ARRAY_CONFIG {
    mipLevel?: number;
    size: {
        width: number,
        height: number;
    };
    itemAmount?: number;
    label?: string;
    format?: GPUTextureFormat;
    /**GPUTextureUsage flags alongside GPUTextureUsage.RENDER_ATTACHMENT, GPUTextureUsage.COPY_DST, GPUTextureUsage.TEXTURE_BINDING */
    usage?: number;
}
export class CubeRegistry {
    #highptr = 0;
    texture;
    #device;
    #config;
    constructor(device: GPUDevice, config: CUBE_ARRAY_CONFIG) {
        this.#device = device;
        this.#config = config;
        this.texture = device.createTexture({
            "label": config.label,
            "format": config.format ?? "rgba8unorm",
            "usage": GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | (config.usage ?? 0),
            "size": {
                "depthOrArrayLayers": (config.itemAmount ?? 256) * 6,
                "height": config.size.height,
                "width": config.size.width
            },
            "mipLevelCount": config.mipLevel,
            "dimension": "2d",
            "textureBindingViewDimension": "cube-array",
        });
    }
    async  #resize(imageBitmap: ImageBitmap, width: number, height: number) {
        CubeRegistry.z_cache_resizerCanvas.width = width;
        CubeRegistry.z_cache_resizerCanvas.height = height;
        CubeRegistry.z_cache_resizerCtx.drawImage(imageBitmap, 0, 0, width, height);
        return await createImageBitmap(CubeRegistry.z_cache_resizerCanvas);
    }
    #changes: Record<number, ImageBitmap> = {};
    async #getBitmap(imageBitmap: ImageBitmap) {
        if (!this.#resizeCached.has(imageBitmap)) {
            this.#resizeCached.set(imageBitmap, await this.#resize(imageBitmap, this.#config.size.width, this.#config.size.height));
        }
        return this.#resizeCached.get(imageBitmap) as ImageBitmap;
    }
    #resizeCached = new Map<ImageBitmap, ImageBitmap>()
    #mapTexture: Record<number, CUBE_TEXTURE> = {}
    async register(tdesc: CUBE_TEXTURE) {
        const offset = this.#highptr * 6;
        for (let i = 0; i < 6; i++) {
            this.#changes[offset + i] = await this.#getBitmap(tdesc[IND_TO_TEXSIDE_LOOKUP[+i] as keyof CUBE_TEXTURE])
        }
        this.#mapTexture[this.#highptr] = tdesc;
        this.#highptr++;
    }
    get(index: number) {
        return this.#mapTexture[index];
    }
    syncGPU() {
        for (const [key, bitmap] of Object.entries(this.#changes)) {
            const targetLayerIndex = Number(key);

            this.#device.queue.copyExternalImageToTexture(
                { source: bitmap, flipY: false },
                { texture: this.texture, mipLevel: 0, origin: { x: 0, y: 0, z: targetLayerIndex } },
                { width: this.#config.size.width, height: this.#config.size.height, depthOrArrayLayers: 1 }
            );
        }

        this.#changes = {};
    }
}
export namespace CubeRegistry {
    export const z_cache_resizerCanvas = document.createElement("canvas");
    export const z_cache_resizerCtx = z_cache_resizerCanvas.getContext("2d") as CanvasRenderingContext2D
}