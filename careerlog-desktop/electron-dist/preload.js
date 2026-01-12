"use strict";
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("careerlog", {
    appVersion: process.env.npm_package_version
});
