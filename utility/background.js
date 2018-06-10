if(chrome && chrome.app) {
  chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create('index.html', {
      outerBounds: {
        width:  1220,
        height: 720
      }
    });
  });
} else if(browser) {
  browser.browserAction.onClicked.addListener(() => {
    browser.windows.create({
      url:    'index.html',
      width:  1220,
      height: 820,
      type:   'panel'
    });
  });
}
