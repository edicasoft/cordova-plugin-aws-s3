package org.fathens.cordova.plugin.aws

import android.content.pm.PackageManager.GET_META_DATA
import android.net.Uri
import android.os.Bundle
import com.amazonaws.auth.AWSCredentialsProvider
import com.amazonaws.auth.CognitoCachingCredentialsProvider
import com.amazonaws.regions.Regions
import org.apache.cordova.CallbackContext
import org.apache.cordova.CordovaPlugin
import org.json.JSONArray
import org.json.JSONObject
import com.amazonaws.services.s3.AmazonS3Client
import com.amazonaws.services.s3.model.DeleteObjectsRequest
import com.amazonaws.services.s3.model.ObjectMetadata
import org.apache.cordova.CordovaResourceApi
import org.apache.cordova.PluginResult
import java.io.File
import java.util.*

public class AwsS3 : CordovaPlugin() {
    private class PluginContext(val holder: AwsS3, val action: String, val callback: CallbackContext) {
        fun error(msg: String?) = callback.error(msg)
        fun success(msg: String? = null) = callback.success(msg)
        fun success(v: Boolean) = callback.sendPluginResult(PluginResult(PluginResult.Status.OK, v))
        fun success(m: Map<*, *>) = callback.success(JSONObject(m))
        fun success(list: List<*>) = callback.success(JSONArray(list))
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
        context?.success(Uri.fromFile(file).toString())
    }

    fun read(args: JSONArray) {
        val obj = s3.getObject(bucketName, args.getString(0))
        val text = obj.objectContent.bufferedReader().readText()
        context?.success(text)
    }

    fun upload(args: JSONArray) {
        val key = args.getString(0)
        val source = parseUri(args.getString(1))
        val meta = ObjectMetadata().apply { contentType = source.mimeType }

        s3.putObject(bucketName, key, source.inputStream, meta)
        context?.success()
    }

    fun write(args: JSONArray) {
        val key = args.getString(0)
        val source = args.getString(1).byteInputStream()
        val meta = ObjectMetadata().apply { contentType = args.getString(2) }

        s3.putObject(bucketName, key, source, meta)
        context?.success()
    }

    fun remove(args: JSONArray) {
        s3.deleteObject(bucketName, args.getString(0))
        context?.success()
    }

    fun removeFiles(args: JSONArray) {
        val keys = (0 until args.length()).map {
            DeleteObjectsRequest.KeyVersion(args.getString(it))
        }
        val req = DeleteObjectsRequest(bucketName).withKeys(keys)
        s3.deleteObjects(req)
        context?.success()
    }

    fun removeDir(args: JSONArray) {
        s3.deleteObjects(DeleteObjectsRequest(bucketName).withKeys(
                list(args.getString(0)).map {
                    DeleteObjectsRequest.KeyVersion(it)
                }
        ))
        context?.success()
    }

    fun copy(args: JSONArray) {
        s3.copyObject(bucketName, args.getString(0), bucketName, args.getString(1))
        context?.success()
    }

    fun move(args: JSONArray) {
        move(args.getString(0), args.getString(1))
    }

    fun moveDir(args: JSONArray) {
        val srcDir = args.getString(0)
        val dstDir = args.getString(1)
        list(srcDir).map { src ->
            move(src, src.replace(srcDir, dstDir))
        }
        context?.success()
    }

    fun list(args: JSONArray) {
        val keys = list(args.getString(0))
        context?.success(keys)
    }

    fun exists(args: JSONArray) {
        val res = s3.doesObjectExist(bucketName, args.getString(0))
        context?.success(res)
    }

    fun url(args: JSONArray) {
        val key = args.getString(0)
        val expir = args.getLong(1) * 1000
        val res = s3.generatePresignedUrl(bucketName, key, Date(Date().time + expir))
        context?.success(res.toString())
    }

    // private impl

    fun move(src: String, dst: String) {
        s3.copyObject(bucketName, src, bucketName, dst)
        s3.deleteObject(bucketName, src)
    }

    fun list(path: String): List<String> {
        val dir = if (path.endsWith("/")) path else "${path}/"
        val res = s3.listObjects(bucketName, dir)
        return res.objectSummaries.map { it.key }
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

    private fun parseUri(source: String): CordovaResourceApi.OpenForReadResult {
        val tmp = Uri.parse(source)
        val uri = webView.resourceApi.remapUri(
                if (tmp.scheme != null) tmp else Uri.fromFile(File(source)))
        return webView.resourceApi.openForRead(uri)
    }
}
