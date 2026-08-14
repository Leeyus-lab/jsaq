# 江苏省大学新生安全知识教育 · 一键完成工具（本地版）

把原 `江苏安全` 项目的三个脚本（main.py / main_login.py / utils.py）**合并精简**，
统计上传已关闭，所有非核心代码已移除，**答案库完全内置**，纯本地运行。
支持 Windows 桌面版（exe）与 Android 手机版（APK），两套界面共用同一网页 UI。

## 目录结构
```
├── jsaq.py          # 控制台版完整源码（可独立运行）
├── app.py           # tkinter GUI 后端逻辑（题目管理/界面）
├── bridge.py        # pywebview 桌面窗口入口（exe 打包入口）
├── database.db      # 答案库（506 题，已内置进 exe / APK）
├── build.bat        # 一键重建 exe（Windows）
├── 安全知识教育一键完成工具.spec  # PyInstaller 打包配置（GUI 版）
├── webui/           # 网页前端（桌面版 + APK 共用）
│   ├── index.html
│   ├── app.js
│   ├── db.js        # 答案库前端查询逻辑
│   └── styles.css
├── icons/           # 程序图标
└── apk/             # Android WebView 工程（Android Studio 可直接打开）
    ├── app/src/main/assets/www/   # APK 内置的同一套网页 UI
    └── app/build.gradle
```

## 使用
- **Windows**：运行 `安全知识教育一键完成工具.exe`（GUI）或 `jsaq.py`（控制台菜单）。
- **Android**：用 Android Studio 打开 `apk/` 目录，构建 APK 后安装到手机。
- 两种入口均支持两种模式：
  - `[1] 登录版`：输入学校关键词 → 账号 → 密码
  - `[2] userId版`：从平台主页复制链接，取 `userid=` 后的纯数字
- 程序自动完成课程学习 + 考试答题，结束给出分数与证书链接。

## 从源码构建

### Windows exe（GUI 版，推荐）
```
pip install pywebview requests pyinstaller
python -m PyInstaller --noconfirm --clean 安全知识教育一键完成工具.spec
```
产物：`dist/安全知识教育一键完成工具.exe`

### Windows exe（控制台版）
双击 `build.bat`，依赖 `requests`、`pyinstaller`（脚本会自动安装）。

### Android APK
```
1. 用 Android Studio 打开 apk/ 目录（自动下载 Gradle 8.2 + SDK 组件）
2. Build -> Build Bundle(s) / APK(s) -> Build APK(s)
3. 产物：apk/app/build/outputs/apk/debug/app-debug.apk
```
详见 `apk/README.txt`。

## 与原版的区别
- ✅ 合并单文件，删掉未使用的开发函数（processData / regMethod 等）和空表引用
- ✅ **彻底移除统计上传**（`upload_stats` / `STATS` 已删除，不再向任何第三方服务器发数据）
- ✅ 答案库 `database.db` 内置进 exe / APK，纯本地运行
- ✅ 修复原脚本答案查询 `IS %s` 的隐患，改为参数化 `= ?`，查答案更稳
- ✅ 图形化桌面（GUI）+ 移动端 APP（WebView 共用同一套 webui）

## 说明
- 本工具仅供学习研究，请自行评估使用场景与平台规则。
- 平台接口若更新，课程/考试流程可能失效，届时需同步更新源码中的接口与 `database.db` 答案。
- 本仓库不包含编译产物（exe/apk）与本机构建环境（JDK / Android SDK），请按上文从源码自行构建。
