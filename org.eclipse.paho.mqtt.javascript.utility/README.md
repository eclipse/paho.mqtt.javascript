How to deploy:
1.Download open source libararies of Dojo toolkit and Gridx.
	1.1 Download Dojo toolkit from http://download.dojotoolkit.org/. Choose the version above 1.8.3.
	1.2 Download Gridx from https://github.com/oria/gridx/releases. Choose the version above 1.2
	1.3 Copy the MQTT JavaScript library "mqttws31.js" to the folder "js/"
	1.4 Put dojo, dijit, dojox and gridx to the folder "js/", namely at the same level as mqttui, e.g:
	* dojo
	* dijit
	* dojox
	* gridx
	* mqttui
	* mqttws31.js
	* dojoConfig.js

How to work
1: Directly open index.html in browser.
2: If can not open directly in a browser, please put the folder of utility in Web Server. This is due to more restrictive handling of HTTP requests from local file system than from a web server.You can disable web security when starting the browser. 
   e.g. Chrome:
   'chrome --disable-web-security ' or 'chrome --allow-file-access-from-files'


License of Dojo,Gridx 
  "AFLv2.1":"http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43"
  "BSD": "http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13"
