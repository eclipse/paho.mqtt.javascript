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
 
define("mqttui/Layout",[
		"dojo/_base/declare",
		"dojo/i18n!mqttui/nls/resource",
		"dojo/_base/lang", 
		"dojo/dom",
		'dojo/dom-construct',
		"dijit/layout/StackContainer", 
		"dijit/layout/ContentPane",
		"dijit/layout/AccordionContainer", 
		"dijit/layout/BorderContainer",
		"dijit/layout/TabContainer",
		'dijit/form/Button',
		'dijit/form/TextBox',
		'dijit/form/Form',
		"dojo/text!./templates/introduction.html"

	],  function(declare, resource,  lang, dom,domCreate,
				StackContainer, ContentPane,AccordionContainer,BorderContainer,
				TabContainer,Button,TextBox,Form,intrTpl){
	
		var layout = declare("mqttui.Layout",null,{
			/**
			*	constructor:
			*	param : dom node id 
			**/

			constructor : function (args){
				// i18n for introconn
				declare.safeMixin(this, args);
				this.inherited(arguments);

				
				//content
				this.content = new StackContainer({
					style: "height: 100%; width: 100%;"
				},this.domContentId);
				
				//page connection
				var connectionPage = this._buildPageConnection();
				this.content.addChild(connectionPage);
				this.content.startup();

			},
			
			/**
			* desc : connection page
			*
			*/
			_buildPageConnection : function(){
				var connectionPage = new dijit.layout.BorderContainer({
					id : 'connection',
					style : 'width:100%,height:100%',
					liveSplitters : true,
					gutters : true,
					title : resource.common.connection,

				});

				//header
				//left navigation of connection
				var leftContainer = new dijit.layout.AccordionContainer({
					//minSize : 20, 
					id : 'connAccord',
					style : "width:200px;padding:0 0 0 0;",
					"class" : 'common-font',
					region : 'leading', 
					splitter : true
				});
			
				var domLeft = domCreate.create('div');
			
			//	domLeft.appendChild(dojo.create('div',{'"class"':'straight-line'}));
				domLeft.appendChild(domCreate.create('div',{'id':'navConn'}));
				domLeft.appendChild(domCreate.create('h3',{innerText:'&nbsp'}));
				domLeft.appendChild(domCreate.create('h3',{innerText:'&nbsp'}));
				
			
				var leftPane = new ContentPane({
				//	minSize : 20,
					id : 'connPane',
					style : "padding:0",
					title : "<a id='aNewConn' class='a-click'> " + 
							"<image alt='New Connection' class='inlineImage' src='images/add_obj.gif'>" + resource.layout.newConnection + "</a>",
					content : domLeft
				});
				
				leftContainer.addChild(leftPane);
				connectionPage.addChild(leftContainer);
				
				//center tab 
				/***** need to use dijit.layout.Tab---to new a tab ,whty****/
				var connTab = new dijit.layout.TabContainer({
					id : 'tabConn',
					region : 'center',
					"class" : 'common-font',
				//	nested : true,
					tabStrip : true
				});
				var intrPane = new ContentPane({
					title : resource.layout.introduction,
					id : 'connIntro',
					closable : false,
					style : "overflow-x:hidden", 
					//innerHTML : "Double click <b>connection</b> to open the connection tab."
					innerHTML : intrTpl.toString()
				});
				connTab.addChild(intrPane);
				
				connectionPage.addChild(connTab);
				leftPane.startup();
				//connectionPage.addChild(this._buildFoot());
				return connectionPage;
			},
			
			
			/**
			*  desc : return a foot content panel
			*/
			_buildFoot : function(){
				var foot = new ContentPane({
					region : 'bottom',
				//	splitter : 'toggle',
					style : 'height:125px;padding-top:5px'
				});
				var divFoot = domCreate.create('div',{
					'class':'footer',
					innerHTML : "<div style='text-align:center;margin:0' >" + resource.layout.copyright + "</div>"
				});
				foot.domNode.appendChild(divFoot);
				return foot;
			},
			

		});

	return layout;
});
