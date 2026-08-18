安全知识教育一键完成工具 —— 手机 APK 工程
================================================

本目录是一个可直接用 Android Studio 打开并构建的原生 WebView 工程。
界面与桌面版完全一致（同一套网页 UI），在手机上直接运行，无需电脑。

【构建步骤】
方式一（推荐）：
  1. 用 Android Studio 打开本目录（apk/）
  2. 等待 Gradle 同步完成（会自动下载 Gradle 8.2 与 Android SDK 组件）
  3. 菜单 Build -> Build Bundle(s) / APK(s) -> Build APK(s)
  4. 生成的 apk 在  app/build/outputs/apk/release/app-release.apk
  5. 手机开启“未知来源安装”，把 apk 传过去安装即可

方式二（命令行，需先装好 Android SDK 并配置 ANDROID_HOME）：
  cd apk
  gradle wrapper          (首次生成本地 gradle wrapper)
  ./gradlew assembleRelease

【说明】
- 网页资源在  app/src/main/assets/www/  （index.html / styles.css / app.js / db.js）
- 答案库 db.js 已内置；如需更新答案，先在本机用电脑版导出新 db.js 再放回 www/
- 工程已开启 setAllowUniversalAccessFromFileURLs，允许网页直接访问平台接口
- 需要联网权限（AndroidManifest 已声明 INTERNET）与明文流量（usesCleartextTraffic=true）

注意：当前打包环境缺少 Android SDK / Java，无法在此直接编译出 .apk 文件；
以上工程已就绪，在装有 Android Studio 的电脑上即可一键产出 apk。
