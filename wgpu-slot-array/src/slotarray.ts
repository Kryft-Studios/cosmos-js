import { GCAB } from "@cosmos-js/wgpu-gcab";
import { Packer, StructConverter, StructValidation, WGPU_STRUCT,StructReader, DATA_TYPE } from "@cosmos-js/wgpu-struct";
type SA_COMMON_FLAGS = {
    /**WGPU Flags other than GPUBufferUsage.COPY_DST and GPUBufferUsage.STORAGE */
    wgpuFlags?: number,
    /**Label of the buffer. by default: "COSMOSJS-SLOT_ARRAY" */
    label?: string;
    /**Initial Amount of Items.*/
    initialCapacity: number;
    struct: WGPU_STRUCT;
    /**Maximum amount of gap between writes.
     * 
     * E.g., There are 3 items;
     * 
     * `[...], [...], [...]`
     * 
     * But only the 1st and 3rd items are changed.
     * 
     * If, maxGap is `0`, then there will be individual writes for index `1` and `3`.
     * 
     * Else, the write will be batched.
     */
    bufferWriteMaxGap?: number;
}
type GROWABLE = { grow: true; growStep: number, maxCapacity: number }
type NON_GROWABLE = { grow?: false }
export type SA_CONFIG = SA_COMMON_FLAGS & (GROWABLE | NON_GROWABLE);
export class SlotArray<FLAGS extends SA_CONFIG> extends Array {
    layout;
    gcab;
    actualArray:DATA_TYPE[] = [];
    currByteLength = 0;
    config;
    constructor(device: GPUDevice, flags: FLAGS) {
        // validation
        StructValidation.validateNames(flags.struct);
        StructValidation.validateBytelength(flags.struct);
        //super
        super(flags.initialCapacity);
        //init
        this.config = flags;
        this.layout = StructConverter.convertToDigestableLayout(flags.struct);
        this.gcab = new GCAB(device, { "byteLength": this.layout.byteLength * flags.initialCapacity, "label": flags.label ?? "@cosmos-js/wgpu-slot-array: Buffer", "maxGap": flags.bufferWriteMaxGap, "usageFlags": GPUBufferUsage.STORAGE | (flags.wgpuFlags ?? 0) })
        const self = this;
        return new Proxy(this, {
            get(target, property, reciever) {
                const numProperty = Number(property)
                if (!isNaN(numProperty)) {
                    return self.actualArray[numProperty]
                }
                return self.actualArray[property as any];
            },
            set(target, property, value, reciever) {
                const numProperty = Number(property);
                if (!isNaN(numProperty)) {
                    if (numProperty > self.actualArray.length) {
                        throw new Error("@cosmos-js/wgpu-slot-array: Cannot set value above the array's length;");
                    }
                    StructValidation.validateData(value, self.layout);
                    if (numProperty === self.actualArray.length) {
                        self.currByteLength += self.layout.byteLength;
                        if (self.currByteLength > (self.config.initialCapacity * self.layout.byteLength)) {
                            if (self.config.grow) {
                                self.currByteLength += self.layout.byteLength * self.config.growStep;
                                self.gcab.resize(self.currByteLength);
                            } else throw new Error("@cosmos-js/wgpu-slot-array: Cannot set property: Buffer has reached max capacity and grow is disabled.")
                        }
                    }
                    self.actualArray[numProperty] = value;
                    const actualIndex = numProperty * self.layout.byteLength;
                    let offset = 0;
                    for (const bit32 of Packer.packToBit32(value, self.layout)) {
                        if (bit32.type === "f32") {
                            self.gcab.setF32(actualIndex + offset, bit32.value);
                        } else if (bit32.type === "i32") {
                            self.gcab.setI32(actualIndex + offset, bit32.value);
                        } else {
                            self.gcab.setU32(actualIndex + offset, bit32.value);
                        }
                        offset += 4;
                    }
                }
                return true;
            },
            "deleteProperty"(target,property){
                if(Number(property) === (self.actualArray.length-1)){
                    self.currByteLength -= self.layout.byteLength;
                    self.gcab.int32.set(Array(self.layout.byteLength).fill(0),self.currByteLength);
                    return true
                }
                else throw new Error("Cannot delete a property in SlotArray.");
            },
        })
    };
    /**
     * Syncs the changes made to the gpu.
     */
    syncChangesToGPU(){
        this.gcab.flush();
    }
    
    /**
     * Syncs the gpu buffer to the cpu.
     */
    async syncCPU() {
        await this.gcab.syncWithGpu();
        
        this.actualArray = [];
        
        const offsetRef = { current: 0 };
        
        const totalItems = this.gcab.ab.byteLength / this.layout.byteLength;
        
        for (let i = 0; i < totalItems; i++) {
            const parsedStruct = StructReader.getDataFromLayout(this.gcab.ab, this.layout, offsetRef);
            this.actualArray.push(parsedStruct);
        }
    }
}