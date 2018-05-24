/**
	* Monitor request completion.
	* @ignore
  */
  
import { global } from "./definitions";

function doTimeout(action, client, args) {
  return () => action.apply(client, args);
}

export default class {
  constructor(client, timeoutSeconds = 30, action, args) {
    this.timeout = global.setTimeout(doTimeout(action, client, args), timeoutSeconds * 1000);
  }

  cancel() {
    global.clearTimeout(this.timeout);
  }
}
