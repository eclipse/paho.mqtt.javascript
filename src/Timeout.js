/**
	* Monitor request completion.
	* @ignore
	*/
function doTimeout(action, client, args) {
  return function() {
    return action.apply(client, args);
  };
};

export default class {
  constructor(client, window, timeoutSeconds = 30, action, args) {
    this._window = window;

    this.timeout = setTimeout(doTimeout(action, client, args), timeoutSeconds * 1000);
  }
  cancel() {
    this._window.clearTimeout(this.timeout);
  }
};
