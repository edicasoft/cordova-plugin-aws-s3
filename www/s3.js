var exec = require("cordova/exec");

var pluginName = "AWSS3Plugin";

var names = [
"download",
"read",
"upload",
"write",
"remove",
"removeFiles",
"removeDir",
"copy",
"move",
"moveDir",
"list",
"exists",
"url"
];

var obj = {};

names.forEach(function(methodName) {
    obj[methodName] = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        return new Promise(function(resolve, reject) {
            exec(resolve, reject, pluginName, methodName, args);
        });
    };
});

module.exports = obj;
