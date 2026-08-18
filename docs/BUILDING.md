# 构建指南（BUILDING）

本文说明如何从源码构建 Windows 桌面版（exe）与 Android 版（apk）。

> 前置提醒：修改 `webui/` 下任何前端文件后，必须将其同步到安卓工程资源目录：
> ```
> cp -r webui/. apk/app/src/main/assets/www/
> ```
> 桌面版打包会自动带上 `webui/`，安卓版只读 `apk/app/src/main/assets/www/`。

---

## 一、从源码直接运行（Windows）

```bash
pip install pywebview requests
python bridge.py
```

要求 Python 3.10+，Windows 10/11（需 WebView2 Runtime，Win11 自带）。

命令行单文件版（无界面）：

```bash
pip install requests
python jsaq.py
```

---

## 二、打包 Windows 桌面版 exe（PyInstaller）

```bash
# 1) 建议在项目根目录创建独立虚拟环境
python -m venv .venv
.venv\Scripts\pip install pywebview requests pyinstaller

# 2) 用随附的 spec 配置打包（入口 bridge.py，自动携带 webui 与 database.db）
.venv\Scripts\python -m PyInstaller --noconfirm 安全教育一键完成工具.spec

# 3) 产物
dist\安全教育一键完成工具.exe
```

说明：

- spec 文件中已包含 `collect_all('webview')`、`datas = webui + database.db`、hidden-imports 等配置，无需额外参数；
- 重新打包前如需清理旧产物，先手动删除 `build/`、`dist/` 目录（部分环境下 `--clean` 参数会被安全软件拦截）；
- exe 端用户数据（设置、公益记录等）持久化于 `%APPDATA%\jsaq_v21\state.json`。

纯命令行版可用随附的 `build.bat` 一键打包（产物为 `dist/jsaq.exe`）。

---

## 三、打包 Android 版 apk（Gradle）

环境要求：JDK 17、Android SDK（compileSdk 见 `apk/app/build.gradle`）、Gradle 8.2+。

```bash
cd apk

# 1) 配置本机 SDK 路径（生成 local.properties，已被 .gitignore 排除）
echo "sdk.dir=D:\\path\\to\\Android\\Sdk" > local.properties

# 2) 构建
set JAVA_HOME=D:\path\to\jdk17
gradle assembleDebug    # 或 gradlew assembleDebug

# 3) 产物
app\build\outputs\apk\debug\app-debug.apk
```

说明：

- 安卓端为 WebView 壳（`MainActivity.java`），加载 `assets/www/` 下的前端，与桌面端共用一套 UI；
- 桌面端能力通过 JS 桥（`pyApi`）调用 Python；安卓端对应实现在 `MainActivity.java` 的 `JavascriptInterface`（JS 端通过 `Android` 对象调用）；
- 正式发布请自行配置签名（`gradle.properties` 中补充 keystore 信息或修改 `app/build.gradle` 的 signingConfig）。

---

## 四、版本号约定

- 软件名称固定为「安全教育工具演示软件」，对外版本号固定 **2.1**；
- apk 内部 `versionCode` 递增（当前 9），`versionName` 保持 2.1。
