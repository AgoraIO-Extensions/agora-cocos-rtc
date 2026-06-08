#pragma once

#include "bindings/jswrapper/SeApi.h"

namespace agora::cocos {

bool register_all_agora_engine_texture(se::Object *obj);
void reset_agora_engine_texture_registry();
int create_agora_engine_texture_slot(int width, int height);
bool is_agora_engine_texture_slot_ready(int slotId);
void update_agora_engine_texture_slot(int slotId, const uint8_t *rgba, size_t rgbaLength, int width, int height);
void update_agora_engine_texture_i420_slot(
    int slotId,
    const uint8_t *dataY,
    int strideY,
    const uint8_t *dataU,
    int strideU,
    const uint8_t *dataV,
    int strideV,
    int width,
    int height,
    int targetWidth,
    int targetHeight,
    int rotation,
    bool mirror);
void update_agora_engine_texture_nv12_slot(
    int slotId,
    const uint8_t *dataY,
    int strideY,
    const uint8_t *dataUV,
    int strideUV,
    int width,
    int height,
    int rotation,
    bool mirror);
void release_agora_engine_texture_slot(int slotId);

} // namespace agora::cocos
