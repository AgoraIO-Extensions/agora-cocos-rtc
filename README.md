# Agora Cocos RTC PoC

单仓库的 `SDK/plugin + example` 结构，用于验证 `Cocos Creator 3.8.x + Agora RTC 4.5.3` 的最小链路。

## 目录

- `sdk/agora-rtc`: 对客户交付的 SDK/plugin 主体
- `example/basic-call`: Cocos 示例工程骨架
- `tests`: 本地 Node 测试
- `docs`: 架构、构建和客户接入说明

## 当前状态

- 已完成 TypeScript SDK 最小接口骨架
- 已完成 Android 依赖补丁逻辑和 iOS SPM 接入说明生成
- 已提供 iOS / Android 原生桥接模板
- 已提供 example 工程骨架与接入脚本

## 本地验证

```bash
npm test
./scripts/prepare-example.sh
./scripts/package-sdk.sh
node ./scripts/fetch-agora-maven.mjs
```

本机已实际执行过：

- `web-desktop` 命令行构建
- `iOS` 命令行导出
- `Android` 命令行导出
- `Android` 离线 `assembleDebug`
- `iOS` `iphonesimulator` 无签名 build

Android 当前最稳定的本地调试入口：

```bash
cd /path/to/agora-cocos-rtc
./scripts/dev-android.sh
```

对应文档：

- `docs/android-debug.md`

iOS 当前的一键本地调试入口：

```bash
cd /path/to/agora-cocos-rtc
./scripts/dev-ios.sh
```

## 当前限制

- `iOS` 已把 bridge 源文件加入 Xcode target，并通过 `iphonesimulator` 编译；但 `SPM` 依赖仍保留在导出指引里，没有自动写进 CMake 生成的 Xcode 工程，因为该工程形态与 Swift Package 解析存在兼容限制。
- `Android` 已通过本地 Maven 镜像绕过 Gradle/JVM 的 TLS 握手问题，并完成离线 `assembleDebug`；后续若要重新拉 Agora 依赖，需要先执行 `node ./scripts/fetch-agora-maven.mjs`。
