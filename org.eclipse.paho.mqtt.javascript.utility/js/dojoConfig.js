/*
 *   
 */
 dojoConfig ={
	async: true,
	isDebug: false,
	locale : "en-us",
	//locale : "zh-cn",
	parseOnLoad:true,
	baseUrl : './',
	packages:[
	{ 
		name : 'dojo',
		location:'js/dojo'
	},{ 
		name : 'dijit',
		location:'js/dijit'
	},
	{ 
		name : 'dojox',
		location:'js/dojox'
	},
	{ 
		name:'idx',
		location:'js/idx'
	},
	{
		name : 'gridx',
		location:'./js/gridx'
	},
	{
		name : 'mqttui',
		location:'./js/mqttui'
	}]
	
 };