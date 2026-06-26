import { GCAB } from "@cosmos-js/wgpu-gcab";
import { DATA_TYPE, Packer, StructConverter, StructReader, StructValidation, WGPU_STRUCT } from "@cosmos-js/wgpu-struct";


type IDA_COMMON_FLAGS = {
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
type SHRINKABLE = {shrink:true, shrinkStep: number, minimumFreeSpace?: number};
type NON_SHRINKABLE = {shrink?:false};
export type IDA_CONFIG = IDA_COMMON_FLAGS & (GROWABLE | NON_GROWABLE) & (SHRINKABLE|NON_SHRINKABLE);

export class IDArray extends Array {
    config;
    layout;
    gcab;
    capacity;
    currByteLength = 0;
    idMap = new Map<number,{gpuIndex:number,value: DATA_TYPE}>();
    gpuToIdMap = new Map<number,number>();
    // gpu highest index
    highestIndPointer = 0;
    z_getind(index:number){
        return this.layout.byteLength*index;
    }
    static GET_LOOKUP = {
        "u32": "getU32",
        "i32": "getI32",
        "f32": "getF32"
    } as const;
    static SET_LOOKUP = {
        "u32": "setU32",
        "i32": "setI32",
        "f32": "setF32"
    } as const;
    z_write(index:number,data:DATA_TYPE){
        let ptr = 0;
        const packed = Packer.packToBit32(data,this.layout);
        for(const item of packed){
            this.gcab[IDArray.SET_LOOKUP[item.type]](index+ptr, item.value);
            ptr+=4;
        }
    }
    /**Internal fn. dont use. */
    z_newind(index:number, value:DATA_TYPE){
        StructValidation.validateData(value,this.layout);
        this.idMap.set(index, {gpuIndex:++this.highestIndPointer,value});
        this.gpuToIdMap.set(this.highestIndPointer,index);
        const indToWriteFrom = this.z_getind(this.highestIndPointer);
        this.z_write(indToWriteFrom, value);
    }
    z_overwriteind(index: number,value:DATA_TYPE){
        const gpuIndex = this.z_getind(this.idMap.get(index)?.gpuIndex as number);
        this.z_write(gpuIndex, value);
    }
    z_setVal(index:number,value:DATA_TYPE){
        if(!this.idMap.get(index)){
            this.z_newind(index,value);
        } else this.z_overwriteind(index,value);
    }
    z_getval(index:number){
        return this.idMap.get(index)?.value;
    }
    z_clear(index:number){
        const gpuIndex = this.z_getind(this.idMap.get(index)?.gpuIndex as number);
        if(!gpuIndex)return;
        for(let i=0;i<=this.layout.byteLength/4;i++){
            this.gcab.setU32(gpuIndex+(i*4),0);
        }
    }
    z_swappop(/**Delete this el*/toi: number){
        // get highest index and clear it
        const fromI =this.gpuToIdMap.get(this.highestIndPointer) as number;
        this.z_clear(fromI);
        if(fromI === toi){
            this.z_clear(fromI);
            this.idMap.delete(fromI);
            this.gpuToIdMap.delete(this.highestIndPointer);
            this.highestIndPointer--;
            return;
        }
        // get gpu index of `to index`
        const gpuIndex = this.z_getind(this.idMap.get(toi)?.gpuIndex as number);
        // get the value we are swapping
        const fromval = this.idMap.get(fromI)?.value as DATA_TYPE;

        // write it
        this.z_write(gpuIndex, fromval);

        // now update its index
        this.idMap.set(fromI, {gpuIndex,value: fromval});

        // delete the to element.
        this.idMap.delete(toi);
        this.gpuToIdMap.delete(gpuIndex);
        this.highestIndPointer--;
    }
    z_growfn(){
        if(!this.config.grow){
            if(this.highestIndPointer>= this.capacity){
                throw new Error("@cosmos-js/wgpu-id-array: elements in the array are more than initialized capacity. Please enable `grow`")
            }
            return;
        }
        const capacity = this.capacity;
        const capacityUsed = this.highestIndPointer;
        if(capacity>=capacityUsed)return;
        while(true){
            if(this.capacity>=capacityUsed)break;
            this.capacity+=this.config.growStep;    
        }
        this.gcab.resize(this.capacity*this.layout.byteLength);
    }
    z_shrinkfn(){
        if(!this.config.shrink)return;
        const spaceNeeded = this.config.shrinkStep + (this.config.minimumFreeSpace??0);
        const capacity = this.capacity;
        const capacityUsed = this.highestIndPointer;

        if((capacity-capacityUsed)>=spaceNeeded){
            const boundaryDontShrinkAfter = this.highestIndPointer + (this.config.minimumFreeSpace??0)
            while(true){
                // highest ind pointer (we use this as "how much elements in gpu are used" as well) = 10
                // minimum free space to add new el = 10;
                // capacity = 100;
                // shrink step = 10;
                // boundary dont shrink after = 30 + 10 = 40
                // (100 - 10) <= 40
                // correct if ok
                if((this.capacity-this.config.shrinkStep)<=boundaryDontShrinkAfter)break;
                this.capacity -= this.config.shrinkStep;
            }
            this.gcab.resize(this.capacity*this.layout.byteLength);
        }
    }
    syncGPU(){
        this.z_growfn();
        this.z_shrinkfn();
        this.gcab.flush();
    };
    async syncCPU(){
        await this.gcab.syncWithGpu();
        const offsetRef  = { current: 0 };
        for(let i=0;i<=this.highestIndPointer;i++){
            const parsedStruct = StructReader.getDataFromLayout(this.gcab.ab, this.layout, offsetRef);
            this.idMap.set(this.gpuToIdMap.get(i) as number, { gpuIndex: i, value: parsedStruct });
        }
    }
    constructor(device: GPUDevice, config: IDA_CONFIG){
        StructValidation.validateNames(config.struct);
        StructValidation.validateBytelength(config.struct);
        super();
        this.config = config;
        this.layout = StructConverter.convertToDigestableLayout(config.struct);
        this.gcab = new GCAB(device, {
            "byteLength": this.currByteLength =  this.layout.byteLength * config.initialCapacity,
            "label": config.label ?? "@cosmos-js/wgpu-id-array",
            "maxGap": config.bufferWriteMaxGap,
            "usageFlags": GPUBufferUsage.STORAGE | (config.wgpuFlags??0)
        })
        this.capacity = config.initialCapacity;
        const self = this;
        return new Proxy(this, {
            get(target, p, receiver) {
                if(typeof p==="symbol")return Reflect.get(target,p,receiver);
                const nump = +p;
                if(!isNaN(nump)){
                    return self.z_getval(nump);
                }
                if(p==="length"){
                    return self.highestIndPointer;
                }
                return Reflect.get(target,p,receiver)
            },
            set(__,p,val,_){
                if(typeof p === "symbol") return false;
                const nump = +p;
                if(!isNaN(nump)){
                    if(val==null){
                        self.z_swappop(nump);
                        return true;
                    }
                    self.z_setVal(nump,val);
                    return true;
                }
                return false;
            },
            deleteProperty(target, p) {
                if(typeof p === "symbol") return false;
                const nump = +p;
                if(!isNaN(nump)){
                    self.z_swappop(nump)
                    return true;
                }
                return false;
            },
        })
    }
};