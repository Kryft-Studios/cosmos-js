import { EO, EngineObjectRaw } from "./eo";
import { Cosmos } from ".";
abstract class CommonGPUObjectManager<CONFIG extends GPUObjectManager.CONFIG = GPUObjectManager.CONFIG> {
    abstract z_eo: EngineObjectRaw
    abstract z_classLabel: string;
    constructor(
        public readonly config: CONFIG,
        public readonly initEncoder: GPUObjectManager.INIT_ENCODER_TYPE<CONFIG>
    ) { }
    /** **Internal Property. Do not touch or your program may explode** */
    z_hasinit = false;
    /**
     * - Runs the `initEncoder` of the given object manager.
     * - You dont' have to `await` if your init encoder is not async.
     * - This function is **idempotent**. Will automatically return if the manager has already been initialized.
     * @throws a `Error` if you have not provided a property required by the config in the return value of `initEncoder`
     * @throws a `Error` if you have provided an incorrect property value in the return value of `initEncoder` which doesn't match the config. *e.g.* The config requires **"GPUBuffer"** but you pass a **"GPURenderPipeline."**
     */
    async init() {
        if (this.z_hasinit) return;
        const result = await this.initEncoder(this.z_eo.device) as Awaited<ReturnType<GPUObjectManager.INIT_ENCODER_TYPE<CONFIG>>>;
        for (const [key, value] of Object.entries(this.config)) {
            if (!result[key]) throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while init: Result doesn't include "${key}"`);
            if (result[key].__brand !== value.type) throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while init: Expected ${value.type} but recieved ${result[key].__brand} at ${key}`);
        }
        this.z_objects = result;
        this.z_hasinit = true;
        // make the properties unconfigurable so the code doesn't explode on runtime due to user's quirks.
        // I dont know why i added this.
        Object.defineProperties(this, {
            "z_objects": {
                "configurable": false,
                "value": result
            },
            "z_hasinit": {
                configurable: false,
                value: true
            }
        })
    }
    /** **Internal Property. Do not touch or your program may explode** */
    z_objects?: Awaited<ReturnType<GPUObjectManager.INIT_ENCODER_TYPE<CONFIG>>>
    /** 
     * Get a property from the object manager.
     * @param property The property you want to access
     * @throws a `Error` if the object manager has not been initialized yet.
     * @throws a `Error` if the object manager's config does not include the given property.
    */
    get(property: keyof CONFIG) {
        if (!this.z_hasinit || !this.z_objects) {
            throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while getting property "${property as string}": GPUObjectManager has not been initialized.`);
        }
        if (!this.config[property]) {
            throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while getting property "${property as string}": Unknown property`)
        }
        return this.z_objects[property]
    }
}
export function DynamicGPUObjectManager(eo: Cosmos.ENGINE_OBJECT) {
    return class DynamicGPUObjectManager<CONFIG extends GPUObjectManager.CONFIG = GPUObjectManager.CONFIG> extends CommonGPUObjectManager<CONFIG> {
        z_classLabel: string = "Cosmos.DynamicGPUObjectManager";
        z_eo = eo;
        /**
         * Set a property in the object manager.
         * @param property The property you want to access
         * @param value The value you want to set.
         * @throws a `Error` if the object manager has not been initialized yet.
         * @throws a `Error` if the config does not include the given property.
         * @throws a `Error` if the value given to set is of incorrect type.
         */
        set<T extends keyof CONFIG>(property: T, value: GPUObjectManager.EXPECTS[CONFIG[T]["type"]]) {
            if (!this.z_hasinit || !this.z_objects) {
                throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while setting property "${property as string}": GPUObjectManager has not been initialized.`);
            }
            if (!this.config[property]) {
                throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while setting property "${property as string}": Unknown property`)
            }
            if (this.config[property].type !== value.__brand) {
                throw new Error(`[Cosmos.DynamicGPUObjectManager] Error while setting property "${property as string}": Expected "${this.config[property].type}"" but recieved "${value.__brand}"`)
            }
            (this.z_objects as Record<keyof CONFIG, any>)[property] = value;
        }
    }
}

export namespace GPUObjectManager {
    export type GPU_OBJECT_TYPE = "GPURenderPipeline" |
        "GPUComputePipeline" |
        "GPUBuffer" | "GPUBindGroup" |
        "GPUShaderModule" |
        "GPUTexture" |
        "GPUTextureView" |
        "GPUSampler" |
        "GPUQuerySet" |
        "GPUBindGroupLayout" |
        "GPUPipelineLayout"

    export interface EXPECTS {
        "GPURenderPipeline": GPURenderPipeline,
        "GPUComputePipeline": GPUComputePipeline,
        "GPUBuffer": GPUBuffer,
        "GPUBindGroup": GPUBindGroup,
        "GPUTexture": GPUTexture,
        "GPUShaderModule": GPUShaderModule,
        "GPUTextureView": GPUTextureView,
        "GPUSampler": GPUSampler,
        "GPUQuerySet": GPUQuerySet,
        "GPUBindGroupLayout": GPUBindGroupLayout,
        "GPUPipelineLayout": GPUPipelineLayout
    }

    export interface FIELD_CONFIG {
        type: GPU_OBJECT_TYPE
    }

    export type CONFIG = Record<string, FIELD_CONFIG>
    export type INIT_ENCODER_TYPE<T extends CONFIG> =
        (
            device: GPUDevice
        ) =>
            | {
                [K in keyof T]: EXPECTS[T[K]["type"]];
            }
            | Promise<{
                [K in keyof T]: EXPECTS[T[K]["type"]];
            }>;
}
export function StaticGPUObjectManager(eo: EngineObjectRaw) {
    return class StaticGPUObjectManager<CONFIG extends GPUObjectManager.CONFIG = GPUObjectManager.CONFIG> extends CommonGPUObjectManager<CONFIG> {
        z_classLabel: string = "Cosmos.DynamicGPUObjectManager";
        z_eo = eo;
    }
}