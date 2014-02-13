/*******************************************************************************
 * Copyright (c) 2013 IBM Corp.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * and Eclipse Distribution License v1.0 which accompany this distribution. 
 *
 * The Eclipse Public License is available at 
 *    http://www.eclipse.org/legal/epl-v10.html
 * and the Eclipse Distribution License is available at 
 *   http://www.eclipse.org/org/documents/edl-v10.php.
 *
 * Contributors:
 *    Tang Zi Han - initial API and implementation 
 *******************************************************************************/

define("mqttui/Mainframe",["dojo/_base/declare",
	"dojo/_base/lang",
	"dojo/topic",
	"mqttui/Layout",
	"mqttui/ControllerConnection"

	
],function(declare,lang,topic,Layout,ControllerConnection){
    var mqttUi = declare("mqttui.Mainframe",null,{
        constructor : function(){
			
			var layout = new Layout({
				domHeaderId : 'header',
				domContentId : 'content'
			});
			this.ctrlConn = new ControllerConnection();
        },
		
		/*
	    *
	    * desc : create all pages
	    *
	    * */
		createPage : function(){
			this.ctrlConn.createNavConn();
		},
		
		
		test : function(){
			console.log('testing in mainframe ...');
		}

    });

    return mqttUi;
});





