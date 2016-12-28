package org.fathens.cordova.plugin.aws

import android.content.pm.PackageManager.GET_META_DATA
import android.os.Bundle
import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.auth.CognitoCachingCredentialsProvider
import com.amazonaws.mobileconnectors.s3.transferutility.TransferListener
import com.amazonaws.mobileconnectors.s3.transferutility.TransferState
import com.amazonaws.mobileconnectors.s3.transferutility.TransferUtility
import com.amazonaws.regions.Regions
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.json.JSONArray
import org.json.JSONObject
import com.amazonaws.services.s3.AmazonS3Client
import com.amazonaws.services.s3.model.DeleteObjectRequest
import com.amazonaws.services.s3.model.DeleteObjectsRequest
import com.amazonaws.services.s3.model.ObjectMetadata
import java.io.File

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

    private val metaData: Bundle by lazy {
        cordova.activity.packageManager.getApplicationInfo(cordova.activity.packageName, GET_META_DATA).metaData
    }

    private val credentialProvider: AWSCredentialsProvider by lazy {
        CognitoCachingCredentialsProvider(
                cordova.activity.applicationContext,
                metaData.getString("org.fathens.aws.cognito.identityPool"),
                Regions.fromName(metaData.getString("org.fathens.aws.region")))
    }

    override fun execute(action: String, args: JSONArray, callbackContext: CallbackContext): Boolean {
        try {
            val method = javaClass.getMethod(action, args.javaClass)
            if (method != null) {
                cordova.threadPool.execute {
                    context = PluginContext(this, action, callbackContext)
                    try {
                        method.invoke(this, args)
                    } catch (ex: Exception) {
                        context?.error(ex.message)
                    }
                }
                return true
            } else {
                return false
            }
        } catch (e: NoSuchMethodException) {
            return false
        }
    }

    // plugin commands

    fun download(args: JSONArray) {
        val file = createTmpFile()
        val obj = s3.getObject(bucketName, args.getString(0))
        file.writeBytes(obj.objectContent.readBytes())
        context?.success(file.absolutePath)
    }

    fun read(args: JSONArray) {
        val obj = s3.getObject(bucketName, args.getString(0))
        val text = obj.objectContent.bufferedReader().readText()
        context?.success(text)
    }

    fun upload(args: JSONArray) {
        s3.putObject(bucketName, args.getString(0), args.getString(1).byteInputStream(), ObjectMetadata())
        context?.success()
    }

    fun write(args: JSONArray) {
        val file = File(args.getString(1))
        s3.putObject(bucketName, args.getString(0), file)
        context?.success()
    }

    fun remove(args: JSONArray) {
        s3.deleteObject(bucketName, args.getString(0))
    }

    fun removeFiles(args: JSONArray) {
        val keys = (0 until args.length()).map {
            DeleteObjectsRequest.KeyVersion(args.getString(it))
        }
        val req = DeleteObjectsRequest(bucketName).withKeys(keys)
        s3.deleteObjects(req)
    }

    fun list(args: JSONArray) {
        val res = s3.listObjects(bucketName, args.getString(0))
        res.
    }

    // private utilities

    private val s3: AmazonS3Client by lazy {
        AmazonS3Client(credentialProvider)
    }

    private val bucketName: String by lazy {
        metaData.getString("org.fathens.aws.s3.bucket")
    }

    private fun createTmpFile(suffix: String = ""): File {
        val dir = cordova.activity.applicationContext.cacheDir
        return File.createTempFile(javaClass.canonicalName, suffix, dir)
    }
}
