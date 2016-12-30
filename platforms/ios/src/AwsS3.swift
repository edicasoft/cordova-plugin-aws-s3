import Foundation
import Cordova
import AWSCore
import AWSS3

fileprivate func log(_ msg: String) {
    print(msg)
}

@objc(AwsS3)
class AwsS3: CDVPlugin {
    // MARK: - Plugin Commands
    
    func download(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            if let req = AWSS3TransferManagerDownloadRequest() {
                req.key = self.getString(0)
                req.bucket = self.bucketName
                
                let tmpDir = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
                let tmpFile = tmpDir.appendingPathComponent("downloading")
                req.downloadingFileURL = tmpFile
                
                self.withTask(AWSS3TransferManager.default().download(req)) { res in
                    self.finish_ok(tmpFile.absoluteString)
                }
            } else {
                self.finish_error("Failed to initialize a request.")
            }
        }
    }
    
    func read(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            let key = self.getString(0)
            
            AWSS3TransferUtility.default().downloadData(fromBucket: self.bucketName, key: key, expression: nil) { (task, url, data, error) in
                if let error = error {
                    self.finish_error(error.localizedDescription)
                } else {
                    if let data = data {
                        let text = String(data: data, encoding: String.Encoding.utf8)
                        self.finish_ok(text)
                    } else {
                        self.finish_error("Empty data")
                    }
                }
            }
        }
    }
    
    func upload(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            if let req = AWSS3TransferManagerUploadRequest() {
                req.body = URL.init(string: self.getString(0))
                req.key = self.getString(1)
                req.bucket = self.bucketName
                
                self.withTask(AWSS3TransferManager.default().upload(req))
            } else {
                self.finish_error("Failed to initialize a request.")
            }
        }
    }
    
    func write(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            let data = self.getString(0).data(using: String.Encoding.utf8)!
            let key = self.getString(1)
            let ct = self.getString(2)
            
            self.withTask(AWSS3TransferUtility.default().uploadData(data, bucket: self.bucketName, key: key, contentType: ct, expression: nil, completionHander: nil))
        }
    }
    
    func remove(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            self.remove(self.getString(0))
        }
    }
    
    func removeFiles(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            let keys = command.arguments.map { $0 as! String }
            self.removeObjects(keys)
        }
    }
    
    func removeDir(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            self.list(self.getString(0)) {
                self.removeObjects($0)
            }
        }
    }
    
    func copy(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            self.copy([self.getString(0) : self.getString(1)])
        }
    }
    
    func move(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            let src = self.getString(0)
            let dst = self.getString(1)
            self.copy([src : dst]) { res in
                self.remove(src)
            }
        }
    }
    
    func moveDir(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            let srcDir = self.getString(0)
            let dstDir = self.getString(1)
            
            self.list(srcDir) { keys in
                var copies: [String : String] = [:]
                keys.forEach { src in
                    copies[src] = src.replacingOccurrences(of: srcDir, with: dstDir)
                }
                self.copy(copies) { res in
                    self.removeObjects(keys)
                }
            }
        }
    }
    
    func list(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            self.list(self.getString(0)) {
                self.finish_ok($0)
            }
        }
    }
    
    func exists(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            if let req = AWSS3GetObjectAclRequest() {
                req.key = self.getString(0)
                req.bucket = self.bucketName
                self.s3.getObjectAcl(req).continue({ task in
                    self.finish_ok(task.error != nil)
                    return nil
                })
            } else {
                self.finish_error("Failed to initialize a request.")
            }
        }
    }
    
    func url(_ command: CDVInvokedUrlCommand) {
        fork(command) {
            let req = AWSS3GetPreSignedURLRequest()
            req.key = self.getString(0)
            req.expires = Date.init(timeIntervalSinceNow: (command.argument(at: 1) as! Double))
            req.bucket = self.bucketName
            req.httpMethod = AWSHTTPMethod.GET
            
            AWSS3PreSignedURLBuilder.default().getPreSignedURL(req).continue({ task in
                if let error = task.error {
                    self.finish_error(error.localizedDescription)
                } else {
                    if let result = task.result {
                        self.finish_ok(result.absoluteString)
                    } else {
                        self.finish_error("Empty result")
                    }
                }
                return nil
            })
        }
    }
    
    // MARK: - Private Impl
    
    private func copy(_ srcToDst: [String : String], _ callback: ((_ res: AnyObject) -> Void)? = nil) {
        func doCopy(src: String, dst: String) -> AWSTask<AnyObject> {
            return AWSTask<AnyObject>.init().continue({ task in
                let req = AWSS3ReplicateObjectRequest()!
                req.bucket = self.bucketName
                req.replicateSource = src
                req.key = dst
                return self.s3.replicateObject(req)
            })
        }
        self.withTask(AWSTask<AnyObject>(forCompletionOfAllTasks: srcToDst.map(doCopy)), callback)
    }
    
    func remove(_ key: String, _ callback: ((_ res: AWSS3DeleteObjectOutput) -> Void)? = nil) {
        if let req = AWSS3DeleteObjectRequest() {
            req.key = self.getString(0)
            req.bucket = self.bucketName
            
            self.withTask(self.s3.deleteObject(req), callback)
        } else {
            self.finish_error("Failed to initialize a request.")
        }
    }
    
    private func list(_ key: String, _ callback: @escaping (_ keys: [String]) -> Void) {
        if let req = AWSS3ListObjectsRequest() {
            req.bucket = self.bucketName
            req.prefix = key
            if !key.hasSuffix("/") {
                req.prefix = key + "/"
            }
            withTask(self.s3.listObjects(req)) { res in
                let keys = res.contents!.map { $0.key! }
                callback(keys)
            }
        } else {
            self.finish_error("Failed to initialize a request.")
        }
    }
    
    private func removeObjects(_ keys: [String], _ callback: ((_ res: AWSS3DeleteObjectsOutput) -> Void)? = nil) {
        if let req = AWSS3DeleteObjectsRequest() {
            req.bucket = self.bucketName
            req.remove = AWSS3Remove()
            req.remove?.objects = keys.map { key in
                let o = AWSS3ObjectIdentifier()
                o!.key = key
                return o!
            }
            
            self.withTask(self.s3.deleteObjects(req), callback)
        } else {
            self.finish_error("Failed to initialize a request.")
        }
    }
    
    private func withTask<T>(_ task: AWSTask<T>, _ callback: ((_ res: T) -> Void)? = nil) {
        task.continue({ task in
            if let error = task.error {
                self.finish_error(error.localizedDescription)
            } else {
                if let callback = callback {
                    if let result = task.result {
                        callback(result)
                    } else {
                        self.finish_error("No result")
                    }
                } else {
                    self.finish_ok()
                }
            }
            return nil
        })
    }
    
    // MARK: - Private Utillities
    
    private var currentCommand: CDVInvokedUrlCommand?
    
    lazy private var infoDict: [String : String] = Bundle.main.infoDictionary!["CordovaAWS"] as! [String : String]
    
    lazy private var bucketName: String = self.infoDict["BucketName"]!
    
    lazy private var s3: AWSS3 = AWSS3.default()
    
    private func getString(_ index: UInt) -> String {
        return currentCommand!.argument(at: index) as! String
    }

    private func fork(_ command: CDVInvokedUrlCommand, _ proc: @escaping () throws -> Void) {
        DispatchQueue.global(qos: DispatchQoS.QoSClass.utility).async(execute: {
            self.currentCommand = command
            defer {
                self.currentCommand = nil
            }
            do {
                try proc()
            } catch (let ex) {
                self.finish_error(ex.localizedDescription)
            }
        })
    }
    
    private func finish_error(_ msg: String!) {
        if let command = self.currentCommand {
            commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_ERROR, messageAs: msg), callbackId: command.callbackId)
        }
    }
    
    private func finish_ok(_ result: Any? = nil) {
        if let command = self.currentCommand {
            log("Command Result: \(result)")
            if let msg = result as? String {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK, messageAs: msg), callbackId: command.callbackId)
            } else if let b = result as? Bool {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK, messageAs: b), callbackId: command.callbackId)
            } else if let array = result as? [Any] {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK, messageAs: array), callbackId: command.callbackId)
            } else if let dict = result as? [String: AnyObject] {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK, messageAs: dict), callbackId: command.callbackId)
            } else {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK), callbackId: command.callbackId)
            }
        }
    }
}
