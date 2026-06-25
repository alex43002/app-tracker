import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("careerlog", {
  appVersion: process.env.npm_package_version
});
