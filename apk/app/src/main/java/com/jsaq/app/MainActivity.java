package com.jsaq.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.DownloadListener;
import android.widget.Toast;
import android.util.Base64;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.IOException;

public class MainActivity extends Activity {
    private WebView webView;

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

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new AndroidBridge(this), "Android");

        // Handle <a download> clicks that WebView would otherwise ignore
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                Toast.makeText(MainActivity.this, "use the in-page button to save", Toast.LENGTH_SHORT).show();
            }
        });

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /* ---------- JS Bridge for saving images ---------- */
    public class AndroidBridge {
        private Context ctx;
        AndroidBridge(Context c) { ctx = c; }

        /**
         * Called from JS: Android.saveImage(base64NoPrefix, filename)
         * Saves a PNG image to the Pictures directory.
         * Returns a human-readable result string.
         */
        @JavascriptInterface
        public String saveImage(String b64, String filename) {
            if (b64 == null || b64.isEmpty()) return "error: empty data";
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                if (filename == null || filename.isEmpty()) filename = "image.png";
                if (!filename.endsWith(".png")) filename += ".png";

                OutputStream os;
                Uri uri = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Android 10+ scoped storage via MediaStore
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Images.Media.DISPLAY_NAME, filename);
                    cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/JSAQ");
                    cv.put(MediaStore.Images.Media.IS_PENDING, 1);
                    uri = ctx.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return "error: cannot create MediaStore entry";
                    os = ctx.getContentResolver().openOutputStream(uri);
                } else {
                    // Android 9 and below: direct file write
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

        @JavascriptInterface
        public void toast(final String msg) {
            ((Activity) ctx).runOnUiThread(new Runnable() {
                @Override public void run() {
                    Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
