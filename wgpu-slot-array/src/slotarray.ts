import {GCAB} from "@cosmos-js/wgpu-gcab";
interface SLOT_ARRAY_CONFIG {};
class SlotArray extends Array {
    gcab;
    constructor(device: GPUDevice, config:SLOT_ARRAY_CONFIG) {
        super();
    }
}