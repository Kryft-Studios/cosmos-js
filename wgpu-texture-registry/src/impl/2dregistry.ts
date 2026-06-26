
export interface D2D_ARRAY_CONFIG {
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
export class D2DRegistry {
    #highptr = 0;
    texture;
    #device;
    #config;
    constructor(device: GPUDevice, config: D2D_ARRAY_CONFIG) {
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
            "textureBindingViewDimension": "2d-array",
        });
    }
    async  #resize(imageBitmap: ImageBitmap, width: number, height: number) {
        D2DRegistry.z_cache_resizerCanvas.width = width;
        D2DRegistry.z_cache_resizerCanvas.height = height;
        D2DRegistry.z_cache_resizerCtx.drawImage(imageBitmap, 0, 0, width, height);
        return await createImageBitmap(D2DRegistry.z_cache_resizerCanvas);
    }
    #changes: Record<number, ImageBitmap> = {};
    async #getBitmap(imageBitmap: ImageBitmap) {
        if (!this.#resizeCached.has(imageBitmap)) {
            this.#resizeCached.set(imageBitmap, await this.#resize(imageBitmap, this.#config.size.width, this.#config.size.height));
        }
        return this.#resizeCached.get(imageBitmap) as ImageBitmap;
    }
    #resizeCached = new Map<ImageBitmap, ImageBitmap>()
    #mapTexture: Record<number, ImageBitmap> = {}
    async register(tdesc: ImageBitmap) {
        const offset = this.#highptr;
        this.#changes[offset] = await this.#getBitmap(tdesc);
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
export namespace D2DRegistry {
    export const z_cache_resizerCanvas = document.createElement("canvas");
    export const z_cache_resizerCtx = z_cache_resizerCanvas.getContext("2d") as CanvasRenderingContext2D
}