cmake_minimum_required(VERSION 3.8)

set(CMAKE_SYSTEM_NAME iOS)
set(APP_NAME "agora-cocos-basic-call"  CACHE STRING "Project Name")

project(${APP_NAME} CXX)

set(CC_PROJECT_DIR ${CMAKE_CURRENT_LIST_DIR})
set(CC_UI_RESOURCES)
set(CC_PROJ_SOURCES)
set(CC_ASSET_FILES)
set(CC_COMMON_SOURCES)
set(CC_ALL_SOURCES)

include(${CC_PROJECT_DIR}/../common/CMakeLists.txt)

list(APPEND CC_PROJ_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcPlugin.mm
    ${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraEngineTextureSlotBridge.mm
)

set_source_files_properties(
    ${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraRtcPlugin.mm
    ${CMAKE_CURRENT_LIST_DIR}/agora-rtc/AgoraEngineTextureSlotBridge.mm
    PROPERTIES
    GENERATED FALSE
)

set(CMAKE_XCODE_ATTRIBUTE_SWIFT_VERSION "5.0")
set(EXECUTABLE_NAME ${APP_NAME}-mobile)

cc_ios_before_target(${EXECUTABLE_NAME})
add_executable(${EXECUTABLE_NAME} ${CC_ALL_SOURCES})
cc_ios_after_target(${EXECUTABLE_NAME})
