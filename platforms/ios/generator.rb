#!/bin/bash

type cordova_plugin_swift > /dev/null 2>&1 || (
gem install specific_install &&
gem specific_install fathens/cordova-plugin-swift
)
cordova_plugin_swift generate
