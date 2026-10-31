package com.vigora.fit

import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout

/** Shell nativo: hospeda o app (HTML/CSS/JS empacotado em assets, 100% offline) em uma WebView em tela cheia. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private val base = "file:///android_asset/www/index.html"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val barColor = Color.parseColor("#0B0D10")
        val root = FrameLayout(this).apply { setBackgroundColor(barColor) }
        web = WebView(this).apply {
            setBackgroundColor(barColor)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = WebSettings.LOAD_DEFAULT
                textZoom = 100
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    if (r.url.scheme == "file") return false
                    startActivity(Intent(Intent.ACTION_VIEW, r.url)); return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onJsConfirm(v: WebView, url: String, message: String, result: JsResult): Boolean {
                    AlertDialog.Builder(this@MainActivity).setMessage(message)
                        .setPositiveButton("OK") { _, _ -> result.confirm() }
                        .setNegativeButton("Cancelar") { _, _ -> result.cancel() }
                        .setOnCancelListener { result.cancel() }.show(); return true
                }
                override fun onJsAlert(v: WebView, url: String, message: String, result: JsResult): Boolean {
                    AlertDialog.Builder(this@MainActivity).setMessage(message)
                        .setPositiveButton("OK") { _, _ -> result.confirm() }.setOnCancelListener { result.confirm() }.show(); return true
                }
                override fun onJsPrompt(v: WebView, url: String, message: String, default: String?, result: JsPromptResult): Boolean {
                    val input = EditText(this@MainActivity).apply { setText(default ?: ""); inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL }
                    AlertDialog.Builder(this@MainActivity).setMessage(message).setView(input)
                        .setPositiveButton("OK") { _, _ -> result.confirm(input.text.toString()) }
                        .setNegativeButton("Cancelar") { _, _ -> result.cancel() }
                        .setOnCancelListener { result.cancel() }.show(); return true
                }
            }
        }
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        root.setOnApplyWindowInsetsListener { v, insets ->
            @Suppress("DEPRECATION") run { v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom); insets.consumeSystemWindowInsets() }
        }
        setContentView(root)
        window.decorView.systemUiVisibility = 0
        load(intent)
    }

    private fun load(i: Intent?) {
        val route = i?.getStringExtra("route")
        web.loadUrl(if (route.isNullOrEmpty()) base else base + route)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); load(intent) }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(window.appBack&&window.appBack())||false") { r -> if (r != "true") finish() }
    }
}
