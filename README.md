# 安全教育工具演示软件 v2.1

江苏省大学新生安全知识教育平台（校园安全通）一键完成工具 · 桌面版 + 安卓版 · 纯本地运行

> 本项目基于开源项目 [jiangsu-safety-platform-skip](https://github.com/Scwizard/jiangsu-safety-competition)（作者 **Scwizard**，Apache-2.0 协议）二次开发而成，在原脚本基础上重构了完整的图形界面、新增了安卓端与公益宣传模块。详见 [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md)。

## 功能一览

- **双端**：Windows 桌面版（pywebview + WebView2）与 Android 版（WebView 壳）共用一套 Web UI
- **两种登录方式**：
  - 账号密码：搜索学校 → 选择学院/班级 → 账号密码登录
  - 链接 / userId：从平台主页复制链接，自动提取 `userid=`
- **一键完成**：自动刷完课程学习 + 考试答题，输出得分与结业证书链接，可下载结业证书
- **在线注册**（v2.1+）：支持在工具内直接注册平台新账号
- **公益模块**：每次启动弹出一条「宝贝回家」走失儿童信息卡片，助力公益寻亲（可在设置中关闭）
- **多主题**：多种颜色主题 / 明暗模式 / 中英文界面
- **答案库内置**：`database.db` 收录约 506 道题目答案，离线可用

## 目录结构

```
.
├──江苏安全工具演示软件              # 软件直接下载文件
│   ├──江苏安全工具演示软件v2.1.exe  # 桌面版应用程序
│   └──江苏安全工具演示软件v2.1.apk  # Android安装包
├── bridge.py                       # 桌面版入口（pywebview 窗口 + JS 桥接）
├── app.py                          # 平台业务逻辑（登录/刷课/考试/证书/统计上传）
├── jsaq.py                         # 核心算法单文件版（命令行可用）
├── database.db                     # 答案库（SQLite，约506题）
├── build.bat                       # 命令行版一键打包脚本
├── 安全教育一键完成工具.spec        # PyInstaller 打包配置（桌面版）
├── webui/                          # 主界面与业务逻辑
│   ├── bbhj.js                     # 宝贝回家公益模块
│   ├── settings.js                 # 设置（主题/语言/多语言）
│   ├── db.js                       # 前端答案库读取（SQL.js 按需加载）
│   ├── licenses.js                 # 开源协议全文展示
│   └── *.txt                       # Apache-2.0 / MPL-2.0 协议全文
├── icons/                          # 应用图标（含 Android mipmap）
├── apk/                            # Android 工程（Gradle + WebView 壳）
└── docs/                           # 构建指南、隐私说明等文档
```

## 快速开始

### 使用预编译版本（推荐普通用户）

到本仓库 [Releases]页面或仓库[江苏安全工具演示软件]文件夹中下载：

| 文件 | 平台 | 说明 |
|---|---|---|
| `安全教育工具演示软件v2.1.exe` | Windows 10/11 x64 | 单文件，双击即用（依赖 WebView2，Win11 自带） |
| `安全教育工具演示软件v2.1.apk` | Android 7.0+ | 直接安装 |

### 从源码运行（桌面版）

```bash
pip install pywebview requests
python bridge.py
```

### 从源码运行（安卓版）

详见 [docs/BUILDING.md](docs/BUILDING.md)。

## 公益模块配置

开源版出于安全考虑**没有内置**宝贝回家公益接口的 Token，首次启动公益模块会提示停用。如需启用：

1. 前往 [起零数据](https://www.istero.com) 注册并申请「宝贝回家公益接口」的免费 Token；
2. 打开 `webui/bbhj.js`（安卓端同步修改 `apk/app/src/main/assets/www/bbhj.js`），把第 11 行的
   `var TOKEN = "";` 改为 `var TOKEN = "你的Token";`
3. 重新启动（或重新打包）即可。

走失儿童数据来自 **宝贝回家寻亲网**（baobeihuijia.com），经起零数据公益 API 分发。本模块仅作公益展示，请勿用于任何商业用途。

## 用量统计说明

与上游原版一致，本工具在任务完成后会向上游作者的统计服务器（`101.133.233.225:81`）匿名上报**本次得分与运行时长**两项数据（格式 `{"score": x, "runtime_ms": y}`），**不包含**任何账号、姓名、学校、IP 等个人信息。如不愿参与，删除 `app.py` 中对 `upload_stats()` 的调用、以及 `webui/app.js` 中的 `uploadStats()` 调用即可。详见 [docs/PRIVACY.md](docs/PRIVACY.md)。

## 免责声明

- 本工具仅供**学习与技术研究**使用，请自行评估使用场景与所在平台的规则。
- 平台接口若更新，刷课/考试流程可能失效，届时需同步更新 `app.py` 中的接口与 `database.db` 答案库。
- 使用本工具产生的一切后果由使用者本人承担，开发者不对任何直接或间接损失负责。

## 许可证

本项目以 [Apache License 2.0](LICENSE) 开源。

第三方组件的版权与许可证见 [ACKNOWLEDGMENTS.md](ACKNOWLEDGMENTS.md)：
- 上游脚本 `jiangsu-safety-platform-skip`（Scwizard，Apache-2.0）
- UI 风格参考 `Aurorαqua`（MPL-2.0）
- pywebview（BSD-3-Clause）、requests（Apache-2.0）等

## 致谢

- **Scwizard**（南京晓庄学院）—— 上游脚本与答案库、统计服务器
- **宝贝回家寻亲网** —— 走失儿童数据
- **起零数据**（istero.com）—— 公益 API 分发
- **Aurorαqua** —— UI 设计风格
