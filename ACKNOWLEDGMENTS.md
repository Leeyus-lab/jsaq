# 致谢与第三方来源说明（ACKNOWLEDGMENTS）

本项目在开发过程中使用了以下项目、数据与服务，特此说明并致谢。软件内「开源许可」与「第三方声明」弹窗中亦展示同样内容。

## 一、代码与设计来源

### 1. jiangsu-safety-platform-skip（上游核心来源）

- **作者**：Scwizard-BA4TLH（南京晓庄学院 · 哔哩哔哩 UID: 403074730）
- **地址**：<https://github.com/Scwizard/jiangsu-safety-platform-skip>
- **协议**：Apache License 2.0
- **获取内容**：
  - `main.py` / `main_login.py` / `utils.py` 三个脚本的完整业务逻辑（登录、学校搜索、课程学习数据包重放、考试答题、证书获取）
  - 答案库 `database.db`（约 506 题，随 Apache-2.0 协议再分发）
  - 用量统计上传接口 `http://101.133.233.225:81/result_update`（上游作者维护，本项目沿用其匿名统计格式）
- **本项目在其基础上的改动**：合并精简为 `jsaq.py` / `app.py`，新增 pywebview 桌面端、Android 端、Web UI、注册功能、宝贝回家公益模块、多主题多语言等；修复答案查询参数化问题。

### 2. Auroraqua-UI（UI 设计风格参考）

- **作者**：micromimo（哔哩哔哩 UID: 1998322381）
- **地址**：<https://github.com/micromimo/Auroraqua-UI>
- **协议**：Mozilla Public License 2.0
- **获取内容**：参考其「液态玻璃 / 冰态果冻」视觉风格（圆角、毛玻璃、多层阴影、渐变主色等设计语言）编写本项目自有的 `styles.css`，未直接复制其 React 组件代码。

## 二、数据与服务来源

### 3. 宝贝回家寻亲网 + 起零数据公益 API

- **数据来源**：[宝贝回家寻亲网](https://www.baobeihuijia.com)（baobeihuijia.com）
- **API 分发**：[起零数据](https://www.istero.com)（api.istero.com）「宝贝回家公益接口」
- **获取内容**：走失儿童公益信息（姓名、特征、走失时间地点、联系方式、照片），用于软件启动时的公益寻亲卡片展示
- **说明**：开源版不内置 API Token，需自行申请（见 README「公益模块配置」）。照片与信息版权归宝贝回家寻亲网及信息提交者所有，仅限公益用途。

### 4. 校园安全通平台（xiaoyuananquantong.com）

- **对接对象**：江苏省大学新生安全知识教育平台（业务接口：登录 / 学校搜索 / 课程 / 考试 / 证书）
- **说明**：本工具仅调用其公开 Web 接口，与该平台无隶属关系；平台接口更新可能导致功能失效。

## 三、开源依赖

| 组件 | 用途 | 协议 |
|---|---|---|
| [pywebview](https://github.com/r0x0r/pywebview) | 桌面端窗口 + JS 桥接 | BSD-3-Clause |
| [requests](https://github.com/psf/requests) | HTTP 请求 | Apache-2.0 |
| [PyInstaller](https://github.com/pyinstaller/pyinstaller) | exe 打包（构建工具） | GPL-2.0-with-bootloader-exception |
| Android WebView / AndroidX（apk 工程依赖） | 安卓端壳 | Apache-2.0 |
| Gradle（构建工具） | 安卓端构建 | Apache-2.0 |
| WebView2 Runtime | Windows 端渲染内核（系统组件） | 微软许可 |

协议全文：Apache-2.0 与 MPL-2.0 已随软件分发（`webui/Apache License 2.0.txt`、`webui/Mozilla Public License 2.0.txt`）。

## 四、许可证兼容性说明

- 本项目整体以 **Apache License 2.0** 授权（与上游一致）；
- 上游代码（Apache-2.0）允许再分发与修改，已按要求保留来源声明；
- Auroraqua-UI（MPL-2.0）仅作风格参考、未复制其源码，不构成衍生作品；若未来直接引入其组件，该部分文件将按 MPL-2.0 单独标注。
