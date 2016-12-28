package org.fathens.cordova.plugin.aws

import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.json.JSONArray
import org.json.JSONObject
import com.amazonaws.services.s3.AmazonS3Client

public class AwsS3 : CordovaPlugin() {
    private class PluginContext(val holder: AwsS3, val action: String, val callback: CallbackContext) {
        fun error(msg: String?) = callback.error(msg)
        fun success() = callback.success(null as? String)
        fun success(msg: String?) = callback.success(msg)
        fun success(obj: JSONObject?) {
            if (obj != null) {
                callback.success(obj)
            } else {
                success()
            }
        }
    }

    private var context: PluginContext? = null

    override fun execute(action: String, args: JSONArray, callbackContext: CallbackContext): Boolean {
        try {
            val method = javaClass.getMethod(action, args.javaClass)
            if (method != null) {
                cordova.threadPool.execute {
                    context = PluginContext(this, action, callbackContext)
                    method.invoke(this, args)
                }
                return true
            } else {
                return false
            }
        } catch (e: NoSuchMethodException) {
            return false
        }
    }

    public fun download(args: JSONObject) {
        val s3 = AmazonS3Client()
    }
}
