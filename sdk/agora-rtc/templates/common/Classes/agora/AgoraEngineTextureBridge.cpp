#include "agora/AgoraEngineTextureBridge.h"

#include <atomic>
#include <cstring>
#include <cstdint>
#include <functional>
#include <mutex>
#include <unordered_map>
#include <utility>
#include <vector>

#if CC_PLATFORM == CC_PLATFORM_ANDROID
#include <jni.h>
#endif

#include "bindings/manual/jsb_conversions.h"
#include "cocos/cocos.h"
#include "core/assets/Texture2D.h"
#include "cocos/base/Log.h"

namespace agora::cocos {

namespace {

inline uint8_t clampColor(int value) {
    if (value < 0) {
        return 0;
    }
    if (value > 255) {
        return 255;
    }
    return static_cast<uint8_t>(value);
}

void convertI420ToRgba(
    const uint8_t *dataY,
    int strideY,
    const uint8_t *dataU,
    int strideU,
    const uint8_t *dataV,
    int strideV,
    int width,
    int height,
    uint8_t *rgba) {
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            const int yValue = dataY[y * strideY + x] & 0xFF;
            const int uValue = dataU[(y / 2) * strideU + (x / 2)] & 0xFF;
            const int vValue = dataV[(y / 2) * strideV + (x / 2)] & 0xFF;

            const int c = yValue - 16;
            const int d = uValue - 128;
            const int e = vValue - 128;

            const int r = (298 * c + 409 * e + 128) >> 8;
            const int g = (298 * c - 100 * d - 208 * e + 128) >> 8;
            const int b = (298 * c + 516 * d + 128) >> 8;

            const int offset = (y * width + x) * 4;
            rgba[offset] = clampColor(r);
            rgba[offset + 1] = clampColor(g);
            rgba[offset + 2] = clampColor(b);
            rgba[offset + 3] = 0xFF;
        }
    }
}

void convertNV12ToRgba(
    const uint8_t *dataY,
    int strideY,
    const uint8_t *dataUV,
    int strideUV,
    int width,
    int height,
    uint8_t *rgba) {
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            const int yValue = dataY[y * strideY + x] & 0xFF;
            const int uvOffset = (y / 2) * strideUV + (x / 2) * 2;
            const int uValue = dataUV[uvOffset] & 0xFF;
            const int vValue = dataUV[uvOffset + 1] & 0xFF;

            const int c = yValue - 16;
            const int d = uValue - 128;
            const int e = vValue - 128;

            const int r = (298 * c + 409 * e + 128) >> 8;
            const int g = (298 * c - 100 * d - 208 * e + 128) >> 8;
            const int b = (298 * c + 516 * d + 128) >> 8;

            const int offset = (y * width + x) * 4;
            rgba[offset] = clampColor(r);
            rgba[offset + 1] = clampColor(g);
            rgba[offset + 2] = clampColor(b);
            rgba[offset + 3] = 0xFF;
        }
    }
}

struct EngineTextureSlot {
    int slotId{0};
    int currentWidth{0};
    int currentHeight{0};
    int pendingWidth{0};
    int pendingHeight{0};
    int pendingLength{0};
    bool released{false};
    bool scheduled{false};
    bool dirty{false};
    bool uploadedFrame{false};
    cc::IntrusivePtr<cc::Texture2D> texture;
    std::vector<uint8_t> stagingRgba;
    std::vector<uint8_t> uploadRgba;
};

class EngineTextureRegistry {
public:
    static EngineTextureRegistry &getInstance() {
        static EngineTextureRegistry instance;
        return instance;
    }

    int createSlot(int width, int height) {
        auto slot = std::make_shared<EngineTextureSlot>();
        slot->slotId = _nextSlotId.fetch_add(1);
        slot->pendingWidth = width;
        slot->pendingHeight = height;
        CC_LOG_INFO("[agora-rtc-native] createSlot slot=%d size=%dx%d", slot->slotId, width, height);

        std::lock_guard<std::mutex> lock(_mutex);
        _slots[slot->slotId] = slot;
        return slot->slotId;
    }

    cc::Texture2D *getTexture(int slotId) {
        std::lock_guard<std::mutex> lock(_mutex);
        const auto iterator = _slots.find(slotId);
        if (iterator == _slots.end()) {
            return nullptr;
        }
        return iterator->second->texture.get();
    }

    bool isSlotReady(int slotId) {
        std::lock_guard<std::mutex> lock(_mutex);
        const auto iterator = _slots.find(slotId);
        if (iterator == _slots.end()) {
            return false;
        }
        return iterator->second->uploadedFrame && iterator->second->texture != nullptr;
    }

    void updateSlot(int slotId, const uint8_t *rgba, size_t rgbaLength, int width, int height) {
        std::shared_ptr<EngineTextureSlot> slot;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            const auto iterator = _slots.find(slotId);
            if (iterator == _slots.end()) {
                return;
            }
            slot = iterator->second;
            if (slot->released) {
                return;
            }
            slot->pendingWidth = width;
            slot->pendingHeight = height;
            slot->pendingLength = static_cast<int>(rgbaLength);
            if (slot->stagingRgba.size() < rgbaLength) {
                slot->stagingRgba.resize(rgbaLength);
            }
            std::memcpy(slot->stagingRgba.data(), rgba, rgbaLength);
            slot->dirty = true;
            if (slot->scheduled) {
                return;
            }
            slot->scheduled = true;
        }

        scheduleApply(slot);
    }

    void updateI420Slot(
        int slotId,
        const uint8_t *dataY,
        int strideY,
        const uint8_t *dataU,
        int strideU,
        const uint8_t *dataV,
        int strideV,
        int width,
        int height) {
        std::shared_ptr<EngineTextureSlot> slot;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            const auto iterator = _slots.find(slotId);
            if (iterator == _slots.end()) {
                return;
            }
            slot = iterator->second;
            if (slot->released) {
                return;
            }
            const auto rgbaLength = static_cast<size_t>(width) * static_cast<size_t>(height) * 4U;
            slot->pendingWidth = width;
            slot->pendingHeight = height;
            slot->pendingLength = static_cast<int>(rgbaLength);
            if (slot->stagingRgba.size() < rgbaLength) {
                slot->stagingRgba.resize(rgbaLength);
            }
            convertI420ToRgba(
                dataY,
                strideY,
                dataU,
                strideU,
                dataV,
                strideV,
                width,
                height,
                slot->stagingRgba.data()
            );
            slot->dirty = true;
            if (slot->scheduled) {
                return;
            }
            slot->scheduled = true;
        }

        scheduleApply(slot);
    }

    void updateNV12Slot(
        int slotId,
        const uint8_t *dataY,
        int strideY,
        const uint8_t *dataUV,
        int strideUV,
        int width,
        int height) {
        std::shared_ptr<EngineTextureSlot> slot;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            const auto iterator = _slots.find(slotId);
            if (iterator == _slots.end()) {
                return;
            }
            slot = iterator->second;
            if (slot->released) {
                return;
            }
            const auto rgbaLength = static_cast<size_t>(width) * static_cast<size_t>(height) * 4U;
            slot->pendingWidth = width;
            slot->pendingHeight = height;
            slot->pendingLength = static_cast<int>(rgbaLength);
            if (slot->stagingRgba.size() < rgbaLength) {
                slot->stagingRgba.resize(rgbaLength);
            }
            convertNV12ToRgba(
                dataY,
                strideY,
                dataUV,
                strideUV,
                width,
                height,
                slot->stagingRgba.data()
            );
            slot->dirty = true;
            if (slot->scheduled) {
                return;
            }
            slot->scheduled = true;
        }

        scheduleApply(slot);
    }

    void releaseSlot(int slotId) {
        std::shared_ptr<EngineTextureSlot> slot;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            const auto iterator = _slots.find(slotId);
            if (iterator == _slots.end()) {
                return;
            }
            slot = iterator->second;
            slot->released = true;
            _slots.erase(iterator);
        }

        scheduleOnCocosThread([slot]() mutable {
            if (slot->texture) {
                // slot->texture->destroy();
                slot->texture = nullptr;
            }
            slot->stagingRgba.clear();
            slot->uploadRgba.clear();
            slot->dirty = false;
            slot->scheduled = false;
        });
    }

    void reset() {
        std::vector<std::shared_ptr<EngineTextureSlot>> slots;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            slots.reserve(_slots.size());
            for (auto &[slotId, slot] : _slots) {
                CC_UNUSED_PARAM(slotId);
                slot->released = true;
                slots.push_back(slot);
            }
            _slots.clear();
        }

        for (auto &slot : slots) {
            scheduleOnCocosThread([slot]() mutable {
                if (slot->texture) {
                    // slot->texture->destroy();
                    slot->texture = nullptr;
                }
                slot->stagingRgba.clear();
                slot->uploadRgba.clear();
                slot->dirty = false;
                slot->scheduled = false;
            });
        }
    }

private:
    void initializeTexture(const std::shared_ptr<EngineTextureSlot> &slot, int width, int height) {
        cc::IntrusivePtr<cc::Texture2D> texture;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            texture = slot->texture;
            if (!texture) {
                texture = ccnew cc::Texture2D();
                slot->texture = texture;
            }
            slot->currentWidth = width;
            slot->currentHeight = height;
        }
        CC_LOG_INFO("[agora-rtc-native] initializeTexture slot=%d size=%dx%d texture=%p", slot->slotId, width, height, texture.get());
        texture->create(
            static_cast<uint32_t>(width),
            static_cast<uint32_t>(height),
            cc::PixelFormat::RGBA8888,
            1,
            0,
            1000
        );
        std::vector<uint8_t> blank(static_cast<size_t>(width) * static_cast<size_t>(height) * 4U, 0);
        texture->uploadData(blank.data());
    }

    void scheduleApply(const std::shared_ptr<EngineTextureSlot> &slot) {
        CC_LOG_INFO("[agora-rtc-native] scheduleApply slot=%d", slot->slotId);
        scheduleOnCocosThread([slot]() {
            EngineTextureRegistry::getInstance().applyPendingFrame(slot);
        });
    }

    void applyPendingFrame(const std::shared_ptr<EngineTextureSlot> &slot) {
        std::vector<uint8_t> rgba;
        int width = 0;
        int height = 0;
        int rgbaLength = 0;
        bool hasTexture = false;
        int currentWidth = 0;
        int currentHeight = 0;

        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (slot->released) {
                slot->scheduled = false;
                slot->dirty = false;
                slot->stagingRgba.clear();
                slot->uploadRgba.clear();
                return;
            }
            width = slot->pendingWidth;
            height = slot->pendingHeight;
            rgbaLength = slot->pendingLength;
            slot->uploadRgba.swap(slot->stagingRgba);
            slot->dirty = false;
            hasTexture = slot->texture != nullptr;
            currentWidth = slot->currentWidth;
            currentHeight = slot->currentHeight;
        }
        CC_LOG_INFO("[agora-rtc-native] applyPendingFrame slot=%d width=%d height=%d rgbaLength=%d hasTexture=%d current=%dx%d", slot->slotId, width, height, rgbaLength, hasTexture ? 1 : 0, currentWidth, currentHeight);

        if (width <= 0 || height <= 0) {
            slot->scheduled = false;
            return;
        }

        if (!hasTexture || currentWidth != width || currentHeight != height) {
            initializeTexture(slot, width, height);
        }

        bool uploadedFrame = false;
        if (rgbaLength > 0 && !slot->uploadRgba.empty()) {
            slot->texture->uploadData(slot->uploadRgba.data());
            uploadedFrame = true;
        }

        bool shouldReschedule = false;
        {
            std::lock_guard<std::mutex> lock(_mutex);
            if (uploadedFrame) {
                slot->uploadedFrame = true;
            }
            if (slot->released) {
                slot->scheduled = false;
            } else if (slot->dirty) {
                shouldReschedule = true;
            } else {
                slot->scheduled = false;
            }
        }

        if (shouldReschedule) {
            scheduleApply(slot);
        }
    }

    static void scheduleOnCocosThread(const std::function<void()> &task) {
        auto engine = CC_CURRENT_ENGINE();
        if (engine == nullptr || engine->getScheduler() == nullptr) {
            auto *engineRaw = engine ? engine.get() : nullptr;
            auto *schedulerRaw = (engine && engine->getScheduler()) ? engine->getScheduler().get() : nullptr;
            CC_LOG_INFO("[agora-rtc-native] scheduleOnCocosThread skipped engine=%p scheduler=%p", engineRaw, schedulerRaw);
            return;
        }
        engine->getScheduler()->performFunctionInCocosThread(task);
    }

    std::mutex _mutex;
    std::unordered_map<int, std::shared_ptr<EngineTextureSlot>> _slots;
    std::atomic_int _nextSlotId{1};
};

static bool js_agoraEngineTexture_getTexture(se::State &s) {
    const auto &args = s.args();
    if (args.size() != 1) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", static_cast<int>(args.size()), 1);
        return false;
    }

    int slotId = 0;
    bool ok = sevalue_to_native(args[0], &slotId, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    auto *texture = EngineTextureRegistry::getInstance().getTexture(slotId);
    if (texture == nullptr) {
      CC_LOG_INFO("[agora-rtc-native] getTexture slot=%d texture=null", slotId);
      s.rval().setNull();
      return true;
    }
    CC_LOG_INFO("[agora-rtc-native] getTexture slot=%d texture=%p", slotId, texture);

    ok = nativevalue_to_se(texture, s.rval(), s.thisObject());
    SE_PRECONDITION2(ok, false, "Error converting Texture2D");
    SE_HOLD_RETURN_VALUE(texture, s.thisObject(), s.rval());
    return true;
}
SE_BIND_FUNC(js_agoraEngineTexture_getTexture)

static bool js_agoraEngineTexture_isSlotReady(se::State &s) {
    const auto &args = s.args();
    if (args.size() != 1) {
        SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", static_cast<int>(args.size()), 1);
        return false;
    }

    int slotId = 0;
    bool ok = sevalue_to_native(args[0], &slotId, s.thisObject());
    SE_PRECONDITION2(ok, false, "Error processing arguments");

    s.rval().setBoolean(EngineTextureRegistry::getInstance().isSlotReady(slotId));
    return true;
}
SE_BIND_FUNC(js_agoraEngineTexture_isSlotReady)

} // namespace

bool register_all_agora_engine_texture(se::Object *obj) {
    se::Value jsbValue;
    if (!obj->getProperty("jsb", &jsbValue)) {
        se::HandleObject jsbObject(se::Object::createPlainObject());
        jsbValue.setObject(jsbObject);
        obj->setProperty("jsb", jsbValue);
    }

    auto *jsbNamespace = jsbValue.toObject();
    se::Value bridgeValue;
    if (!jsbNamespace->getProperty("agoraEngineTexture", &bridgeValue)) {
        se::HandleObject bridgeObject(se::Object::createPlainObject());
        bridgeValue.setObject(bridgeObject);
        jsbNamespace->setProperty("agoraEngineTexture", bridgeValue);
    }

    auto *bridgeObject = bridgeValue.toObject();
    const bool ok = bridgeObject->defineFunction("getTexture", _SE(js_agoraEngineTexture_getTexture));
    return ok && bridgeObject->defineFunction("isSlotReady", _SE(js_agoraEngineTexture_isSlotReady));
}

void reset_agora_engine_texture_registry() {
    EngineTextureRegistry::getInstance().reset();
}

int create_agora_engine_texture_slot(int width, int height) {
    return EngineTextureRegistry::getInstance().createSlot(width, height);
}

bool is_agora_engine_texture_slot_ready(int slotId) {
    return EngineTextureRegistry::getInstance().isSlotReady(slotId);
}

void update_agora_engine_texture_slot(int slotId, const uint8_t *rgba, size_t rgbaLength, int width, int height) {
    EngineTextureRegistry::getInstance().updateSlot(slotId, rgba, rgbaLength, width, height);
}

void update_agora_engine_texture_i420_slot(
    int slotId,
    const uint8_t *dataY,
    int strideY,
    const uint8_t *dataU,
    int strideU,
    const uint8_t *dataV,
    int strideV,
    int width,
    int height) {
    EngineTextureRegistry::getInstance().updateI420Slot(
        slotId,
        dataY,
        strideY,
        dataU,
        strideU,
        dataV,
        strideV,
        width,
        height
    );
}

void update_agora_engine_texture_nv12_slot(
    int slotId,
    const uint8_t *dataY,
    int strideY,
    const uint8_t *dataUV,
    int strideUV,
    int width,
    int height) {
    EngineTextureRegistry::getInstance().updateNV12Slot(
        slotId,
        dataY,
        strideY,
        dataUV,
        strideUV,
        width,
        height
    );
}

void release_agora_engine_texture_slot(int slotId) {
    EngineTextureRegistry::getInstance().releaseSlot(slotId);
}

} // namespace agora::cocos

extern "C" {

#if CC_PLATFORM == CC_PLATFORM_ANDROID

JNIEXPORT jint JNICALL Java_io_agora_cocos_rtc_render_AgoraEngineTextureSlotBridge_nativeCreateSlot(
    JNIEnv * /*env*/,
    jclass /*clazz*/,
    jint width,
    jint height) {
    return agora::cocos::create_agora_engine_texture_slot(width, height);
}

JNIEXPORT void JNICALL Java_io_agora_cocos_rtc_render_AgoraEngineTextureSlotBridge_nativeUpdateSlot(
    JNIEnv *env,
    jclass /*clazz*/,
    jint slotId,
    jobject rgbaBuffer,
    jint rgbaLength,
    jint width,
    jint height) {
    if (env == nullptr || rgbaBuffer == nullptr || rgbaLength <= 0) {
        return;
    }

    auto *bufferPtr = reinterpret_cast<uint8_t *>(env->GetDirectBufferAddress(rgbaBuffer));
    jlong bufferCapacity = env->GetDirectBufferCapacity(rgbaBuffer);
    if (bufferPtr == nullptr || bufferCapacity < rgbaLength) {
        return;
    }
    agora::cocos::update_agora_engine_texture_slot(
        slotId,
        bufferPtr,
        static_cast<size_t>(rgbaLength),
        width,
        height
    );
}

JNIEXPORT void JNICALL Java_io_agora_cocos_rtc_render_AgoraEngineTextureSlotBridge_nativeUpdateI420Slot(
    JNIEnv *env,
    jclass /*clazz*/,
    jint slotId,
    jobject dataY,
    jint strideY,
    jobject dataU,
    jint strideU,
    jobject dataV,
    jint strideV,
    jint width,
    jint height) {
    if (env == nullptr || dataY == nullptr || dataU == nullptr || dataV == nullptr) {
        return;
    }

    auto *yPtr = reinterpret_cast<uint8_t *>(env->GetDirectBufferAddress(dataY));
    auto *uPtr = reinterpret_cast<uint8_t *>(env->GetDirectBufferAddress(dataU));
    auto *vPtr = reinterpret_cast<uint8_t *>(env->GetDirectBufferAddress(dataV));
    if (yPtr == nullptr || uPtr == nullptr || vPtr == nullptr) {
        return;
    }

    agora::cocos::update_agora_engine_texture_i420_slot(
        slotId,
        yPtr,
        strideY,
        uPtr,
        strideU,
        vPtr,
        strideV,
        width,
        height
    );
}

JNIEXPORT void JNICALL Java_io_agora_cocos_rtc_render_AgoraEngineTextureSlotBridge_nativeReleaseSlot(
    JNIEnv * /*env*/,
    jclass /*clazz*/,
    jint slotId) {
    agora::cocos::release_agora_engine_texture_slot(slotId);
}

#endif

} // extern "C"
