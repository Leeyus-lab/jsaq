package com.jsaq.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.util.Base64;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String CHANNEL_ID = "bbhj_charity";
    private static final int REQ_NOTIF = 10001;
    private WebView webView;
    private String pendingCaseId = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowUniversalAccessFromFileURLs(true);
        ws.setAllowFileAccess(true);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (pendingCaseId != null) {
                    final String id = pendingCaseId;
                    pendingCaseId = null;
                    view.evaluateJavascript("window.__openCase && window.__openCase('" + id + "')", null);
                }
            }
        });
        webView.addJavascriptInterface(new AndroidBridge(this), "Android");

        webView.loadUrl("file:///android_asset/www/index.html");

        handleCaseIntent(getIntent());
        createChannel();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleCaseIntent(intent);
    }

    private void handleCaseIntent(Intent intent) {
        if (intent != null && intent.hasExtra("case_id")) {
            String id = intent.getStringExtra("case_id");
            if (id != null && !id.isEmpty()) {
                if (webView.getUrl() == null) {
                    pendingCaseId = id;
                } else {
                    webView.evaluateJavascript("window.__openCase && window.__openCase('" + id + "')", null);
                }
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "寻亲公益提醒", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("走失儿童信息推送，不推送广告");
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    /* ---------- JS Bridge ---------- */
    public class AndroidBridge {
        private Context ctx;
        AndroidBridge(Context c) { ctx = c; }

        /**
         * v2.1 修复：原文件名固定（如 结业证书.png），Android 10+ MediaStore
         * 同目录同名第二次插入冲突导致第二张起保存失败。
         * 现在自动追加时间戳保证文件名唯一。
         */
        private String uniqueName(String filename) {
            if (filename == null || filename.isEmpty()) filename = "image.png";
            if (!filename.toLowerCase().endsWith(".png") && !filename.toLowerCase().endsWith(".jpg")) {
                filename += ".png";
            }
            String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            int dot = filename.lastIndexOf('.');
            return filename.substring(0, dot) + "_" + stamp + filename.substring(dot);
        }

        @JavascriptInterface
        public String saveImage(String b64, String filename) {
            if (b64 == null || b64.isEmpty()) return "error: empty data";
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                filename = uniqueName(filename);

                OutputStream os;
                Uri uri = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                    cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/JSAQ");
                    cv.put(MediaStore.Images.Media.IS_PENDING, 1);
                    uri = ctx.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return "error: cannot create MediaStore entry";
                    os = ctx.getContentResolver().openOutputStream(uri);
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "JSAQ");
                    if (!dir.exists()) dir.mkdirs();
                    File file = new File(dir, filename);
                    os = new FileOutputStream(file);
                }

                if (os == null) return "error: cannot open output stream";
                os.write(bytes);
                os.flush();
                os.close();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && uri != null) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                    ctx.getContentResolver().update(uri, cv, null, null);
                }

                return "ok:" + filename;
            } catch (Exception e) {
                Log.e("AndroidBridge", "saveImage error", e);
                return "error: " + e.getMessage();
            }
        }

        /** 分享图片到其他应用（v2.1 海报分享） */
        @JavascriptInterface
        public String shareImage(String b64, String filename, String title) {
            if (b64 == null || b64.isEmpty()) return "error: empty data";
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                filename = uniqueName(filename);
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                Uri uri;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/JSAQ");
                    uri = ctx.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                } else {
                    uri = ctx.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                }
                if (uri == null) return "error: cannot create MediaStore entry";
                OutputStream os = ctx.getContentResolver().openOutputStream(uri);
                os.write(bytes); os.flush(); os.close();

                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_TEXT, title == null ? "宝贝回家寻亲海报" : title);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final Intent chooser = Intent.createChooser(send, title == null ? "分享" : title);
                ((Activity) ctx).runOnUiThread(new Runnable() {
                    @Override public void run() { ctx.startActivity(chooser); }
                });
                return "ok";
            } catch (Exception e) {
                Log.e("AndroidBridge", "shareImage error", e);
                return "error: " + e.getMessage();
            }
        }

        /** 用系统浏览器打开外部链接（v2.1：应用内不跳走，避免返回错乱） */
        @JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || url.isEmpty()) return;
            ((Activity) ctx).runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        ctx.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    } catch (Exception e) {
                        Toast.makeText(ctx, "无法打开链接", Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }

        /** 通知权限是否已授予 */
        @JavascriptInterface
        public boolean isNotifGranted() {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            return nm != null && nm.areNotificationsEnabled();
        }

        /** 调起系统通知权限请求（结果通过 window.__notifResult 回调） */
        @JavascriptInterface
        public void requestNotifPermission() {
            if (Build.VERSION.SDK_INT >= 33) {
                ((Activity) ctx).runOnUiThread(new Runnable() {
                    @Override public void run() {
                        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
                    }
                });
            } else {
                notifyJs(((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).areNotificationsEnabled());
            }
        }

        /** 跳转系统通知设置页 */
        @JavascriptInterface
        public void openNotifSettings() {
            try {
                Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
                ctx.startActivity(i);
            } catch (Exception e) {
                try {
                    ctx.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", ctx.getPackageName(), null)));
                } catch (Exception ignored) {}
            }
        }

        /** 发送寻亲通知（点击跳转对应案例详情） */
        @JavascriptInterface
        public void notify(final String title, final String text, final String caseId) {
            try {
                Intent open = new Intent(ctx, MainActivity.class);
                open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                open.putExtra("case_id", caseId == null ? "" : caseId);
                int code = (caseId == null ? "" : caseId).hashCode();
                PendingIntent pi = PendingIntent.getActivity(ctx, code, open,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

                Notification.Builder nb;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    nb = new Notification.Builder(ctx, CHANNEL_ID);
                } else {
                    nb = new Notification.Builder(ctx);
                }
                nb.setSmallIcon(android.R.drawable.ic_menu_search)
                        .setContentTitle(title == null ? "寻亲信息" : title)
                        .setContentText(text == null ? "" : text)
                        .setContentIntent(pi)
                        .setAutoCancel(true);
                NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) nm.notify(code, nb.build());
            } catch (Exception e) {
                Log.e("AndroidBridge", "notify error", e);
            }
        }

        private void notifyJs(final boolean granted) {
            final WebView wv = MainActivity.this.webView;
            if (wv == null) return;
            wv.post(new Runnable() {
                @Override public void run() {
                    wv.evaluateJavascript("window.__notifResult && window.__notifResult(" + granted + ")", null);
                }
            });
        }

        @JavascriptInterface
        public void toast(final String msg) {
            ((Activity) ctx).runOnUiThread(new Runnable() {
                @Override public void run() {
                    Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (android.webkit.WebView.class != null && webView != null && nm != null) {
                webView.post(new Runnable() {
                    @Override public void run() {
                        NotificationManager nm2 = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                        webView.evaluateJavascript(
                                "window.__notifResult && window.__notifResult(" + (nm2 != null && nm2.areNotificationsEnabled()) + ")", null);
                    }
                });
            }
        }
    }
}
