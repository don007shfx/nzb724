// Minimal preload. The renderer needs no Node access; keeping the bridge empty
// is deliberate, so a compromised page cannot reach the host.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('nzb724', {
  platform: process.platform,
  desktop: true,
});
