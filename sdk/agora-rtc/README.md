# Agora RTC Cocos Plugin

面向 `Cocos Creator 3.8.x` 的 Agora RTC 第一阶段 PoC 插件。

## 包含内容

- `js/`: TypeScript SDK 包装层
- `dist/`: Cocos extension runtime 与构建钩子
- `sdk-config.json`: Android/iOS 依赖与构建版本的统一配置真源
- `templates/android`: Android 桥接模板
- `templates/ios`: iOS 桥接模板
- `cc_plugin.json`: 原生插件声明

## 第一阶段接口

- `initialize`
- `joinChannel`
- `leaveChannel`
- `enableLocalAudio`
- `enableLocalVideo`
- `destroy`
