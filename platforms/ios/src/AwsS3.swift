import Foundation
import Cordova
import AWSCognito
import AWSS3

fileprivate func log(_ msg: String) {
    print(msg)
}

@objc(AwsS3)
class AwsS3: CDVPlugin {
    // MARK: - Plugin Commands
    
    func download(_ command: CDVInvokedUrlCommand) {
        fork(command) {
        }
    }
    
    // MARK: - Private Utillities
    
    private var currentCommand: CDVInvokedUrlCommand?
    
    private func fork(_ command: CDVInvokedUrlCommand, _ proc: @escaping () -> Void) {
        DispatchQueue.global(qos: DispatchQoS.QoSClass.utility).async(execute: {
            self.currentCommand = command
            defer {
                self.currentCommand = nil
            }
            proc()
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
            } else if let dict = result as? [String: AnyObject] {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK, messageAs: dict), callbackId: command.callbackId)
            } else if result == nil {
                commandDelegate!.send(CDVPluginResult(status: CDVCommandStatus_OK), callbackId: command.callbackId)
            }
        }
    }
}
