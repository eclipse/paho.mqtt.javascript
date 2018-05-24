import { global } from "./definitions";
let Storage;

function localStorageProvider(nativeStorage) {
  return class {
    constructor(key) {
      // Local storagekeys are qualified with the following string.
      // The conditional inclusion of path in the key is for backward
      // compatibility to when the path was not configurable and assumed to
      // be /mqtt
      this.key = key;
    }

    setItem(type, identifier, obj) {
      nativeStorage.setItem(type + this.key + identifier, JSON.stringify(obj));
    }

    removeItem(type, identifier) {
      nativeStorage.removeItem(type + this.key + identifier);
    }

    entries() {
      const all = [];
      for(const key in nativeStorage) {
        if(key.indexOf("Sent:" + this.key) === 0 || key.indexOf("Received:" + this.key) === 0) {
          all.push([key.replace(/:.*/, ":"), JSON.parse(nativeStorage.getItem(key))]);
        }
      }
      return all;
    }
  };
}

if("localStorage" in global && global.localStorage !== null) {
  Storage = localStorageProvider(global.localStorage);
} else if(global.chrome && global.chrome.storage && global.chrome.storage.local) {
  Storage = localStorageProvider(global.chrome.storage.local);
}

export default Storage;
