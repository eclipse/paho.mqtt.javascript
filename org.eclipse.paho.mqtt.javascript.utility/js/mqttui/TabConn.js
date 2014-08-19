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
define("mqttui/TabConn", ["dojo/_base/declare",
						"dojo/i18n!mqttui/nls/resource",
						"dojo/_base/lang",
						"dojo/parser",
						"dojo/topic",
						"dojo/query",
						"dojo/date/locale",
						"dojo/dom",
						"dojo/dom-construct",
	
						"dijit/form/Button",
						"dijit/form/CheckBox",
						"dijit/form/TextBox",
						"dijit/form/Textarea",
						"dijit/form/Select",
						"dijit/form/ComboBox",
						
						//"idx/widget/Dialog",
						"dijit/Dialog",
						
						"dijit/layout/ContentPane",
						"dijit/layout/BorderContainer",
						"dijit/layout/TabContainer",
						"gridx/Grid",
						"gridx/core/model/cache/Async",
						"mqttui/GridxModules",
						"dojo/store/Memory",
						"dojo/store/Observable",
						//templates
						"dojo/text!./templates/connectionTabTpl.html"
						
], function(declare, resource, lang, parser, topic,query, locale,dom,domCreate,
			Button,	CheckBox,TextBox,Textarea,Select,ComboBox,Dialog,
			ContentPane,BorderContainer,TabContainer,
			Grid, Cache, gridModules, Memory,Observable,
			ConnTpl){
	var TabConn = declare("mqttui.TabConn", null, {
		constructor: function(args){
			declare.safeMixin(this, args);
			this.inherited(arguments);
			
			if(this.objConn.name){
				this.strConn = this.objConn.name;
			}else{
				this.strConn = this.objConn.id;
			}
			
			this.subTopicHis = new Memory({
				data:[]
			});
			this.pubTopicHis = new Memory({
				data:[]
			});
			this.hisMem = new Memory({
				data : []
			});
			//hisMem = this.hisMem;
			this.lastMsgMem = new Memory({
				data : []
			});
			this.HAMem = new Memory({ data:[] });
			
			this.gridLayout = {
				'histroy':[	
					{id: 'event', field: 'event', name: 'Event', width: '15%'},
					{id: 'topic', field: 'topic', name: 'Topic', width: '20%'},
					{id: 'message', field: 'message', name: 'Message', width: '25%'},
					{id: 'qos', field: 'qos', name: 'Qos', width: '10%'},
					{id: 'retained', field: 'retained', name: 'Retained', width: '12%'},
					{id: 'time', field: 'time', name: 'Time', width: '18%'}
				],'lastMsg' : [
					{id: 'topic', field: 'topic', name: 'Topic', width: '25%'},
					{id: 'message', field: 'message', name: 'Message', width: '30%'},
					{id: 'qos', field: 'qos', name: 'Qos', width: '10%'},
					{id: 'retained', field: 'retained', name: 'Retained', width: '15%'},
					{id: 'time', field: 'time', name: 'Time', width: '20%'}
				],'optionHA' : [
					{ field: "choose", name:"Choose", width: '10%', alwaysEditing: true,
						editor: "dijit.form.CheckBox",
						editorArgs: {
							props: 'value: true'
						}
					},{
						id:'host',field:'host',name:'Host', width:'60%', editable: true
					},{
						id:'port',field:'port',name:'Port', width:'30%', editable: true,
						editor: "dijit.form.NumberTextBox"
					}
				]
				
			};
			//this.receivedMsgQueue = [];
			this.currSubTopic = {};
			this.currUnsubTopic = {};
			this.currPubTopic = {};
			
			this.isConnected = false;
			//console.log('objConn',this.objConn);
			this.templateStr = dojo.string.substitute(ConnTpl.toString(),{
				objConn : this.objConn
			});
			this._createPane();
			
		},
		
		_createPane : function(){
			var connName = this.objConn.name;
			var parentPane = dijit.byId(this.parentPaneId);
			if(!parentPane){
				console.warn('[%s]parent pane not exist',this.parentPaneId);
			}
			var self = this;
			var connPane = new ContentPane({
				id : 'conn-'+connName, 
				title : connName, 
				closable : true,
				content : this.templateStr,
				onClose : function(){
					console.log('closing this content pane');
					if(confirm(resource.common.closeConfirm)){
						//this.destroyRecursive();
						self.selfDestroy();
						//that.closeConnection(connName);
						return true;
					}else{
						return false;
					}
					
				},
				onShow : function(){
					//dijit.byId('childTabConn-'+connName).selectChild(dijit.byId('childQM-'+connName));
				}
			});
			parentPane.addChild(connPane);
			parentPane.selectChild(connPane);
			
			
		},
		
		startup : function(){

			//title pane do not load its widget automatically 
			parser.parse(dom.byId('forLoad-'+this.strConn)).then(dojo.hitch(this,function(instances){
				this._bindEvent();
				this._setData(this.objConn);
			}));
			
			//create grid
			this.hisGrid = this._showHisGrid();
			this.hisGrid.placeAt('connHistroy-'+this.strConn);
			this.hisGrid.resize();
			
			this.lastMsgGrid = this._showLastMsgGrid();
			this.lastMsgGrid.placeAt('connLastMsg-'+this.strConn);
			this.lastMsgGrid.resize();
			
			//HA 
			this.HAGrid = this._showHAGrid();
			this.HAGrid.placeAt('connHAList-'+this.strConn);
			//this.HAGrid.resize();
			
		},
		
		_bindEvent : function(){
			//Connect button
			dijit.byId('btnConn-'+this.strConn).on('click',dojo.hitch(this,function(){
				this.mqttConnect();
				console.log('client connect');
				
			}));
			//Disconnect button
			dijit.byId('btnDisConn-'+this.strConn).on('click',dojo.hitch(this,function(){
				this.mqttDisconnect();
				console.log('client disconnect');
			}));
			//subscribe button
			dijit.byId('btnSub-'+this.strConn).on('click',dojo.hitch(this,function(){
				this.mqttSub();
				console.log('client subscribe');
			}));
			//unsubscribe button
			dijit.byId('btnUnsub-'+this.strConn).on('click',dojo.hitch(this,function(){
				this.mqttUnsub();
				console.log('client unsubscribe');
			}));
			dijit.byId('btnPub-'+this.strConn).on('click',dojo.hitch(this,function(){
				this.mqttPub();
				console.log('client publish message');
			}));
			//subscribed topic list 
			dijit.byId('connSubTopic-'+this.strConn).on('change',dojo.hitch(this,function(value){
				var item = this.subTopicHis.get(value); // id = name(value)
				if(item && isNumber(item.qos)){
					dijit.byId('connSubQos-'+this.strConn).setValue(item.qos);
				}
			}));
			dijit.byId('connPubTopic-'+this.strConn).on('change',dojo.hitch(this,function(value){
				var item = this.pubTopicHis.get(value); // id = name(value)
				if(item && isNumber(item.qos)){
					dijit.byId('connPubQos-'+this.strConn).setValue(item.qos);
				}
				if(item && isBoolean(item.retained)){
					dijit.byId('connIsRetain-'+this.strConn).setChecked(item.retained);
				}
				
			}));
			//Radio for uri or host&port
			dijit.byId('radioUri-'+this.strConn).on('change',dojo.hitch(this,function(){
				if(dijit.byId('radioUri-'+this.strConn).checked){
					dijit.byId('connHost-'+this.strConn).setDisabled(true);
					dijit.byId('connPort-'+this.strConn).setDisabled(true);
					dijit.byId('connUri-'+this.strConn).setDisabled(false);
				}else{
					dijit.byId('connHost-'+this.strConn).setDisabled(false);
					dijit.byId('connPort-'+this.strConn).setDisabled(false);
					dijit.byId('connUri-'+this.strConn).setDisabled(true);
				}
			}));
			//OPTIONS
			//using HA
			dijit.byId('connIsHA-'+this.strConn).on('change',dojo.hitch(this,function(){
				if(dijit.byId('connIsHA-'+this.strConn).checked){
					dijit.byId("titlepaneHA-"+this.strConn).set('open',true);
				}else{
					//dijit.byId("titlepaneHA-"+this.strConn).set('open',false);
				}
			}));
			//using LWT
			dijit.byId('connIsLWT-'+this.strConn).on('change',dojo.hitch(this,function(){
				if(dijit.byId('connIsLWT-'+this.strConn).checked){
					dijit.byId("titlepaneLWT-"+this.strConn).set('open',true);
				}else{
					dijit.byId("titlepaneLWT-"+this.strConn).set('open',false);
				}
			}));
			//using login
			dijit.byId('connIsLogin-'+this.strConn).on('change',dojo.hitch(this,function(){
				if(dijit.byId('connIsLogin-'+this.strConn).checked){
					dijit.byId('connUser-'+this.strConn).setDisabled(false);
					dijit.byId('connPasswd-'+this.strConn).setDisabled(false);
				}else{
					dijit.byId('connUser-'+this.strConn).setDisabled(true);
					dijit.byId('connPasswd-'+this.strConn).setDisabled(true);
				}
			}));
			
		},
		
		_setData : function(objConn){
			//connection title pane
			if(objConn.isUri){
				dijit.byId('radioIp-'+this.strConn).setChecked(false);
				dijit.byId('radioUri-'+this.strConn).setChecked(true);
				dijit.byId('connHost-'+this.strConn).setDisabled(true);
				dijit.byId('connPort-'+this.strConn).setDisabled(true);
				dijit.byId('connUri-'+this.strConn).setDisabled(false);
			}
			if(objConn.host && isString(objConn.host)){
				if(!dijit.byId('connHost-'+this.strConn)){
					console.warn('[%s]dijit not exist!','connHost-'+this.strConn);
				}else{
					dijit.byId('connHost-'+this.strConn).setValue(objConn.host);
				}
			}
			if(objConn.port && isNumber(objConn.port)){
				if(!dijit.byId('connPort-'+this.strConn)){
					console.warn('[%s]dijit not exist!','connPort-'+this.strConn);
				}else{
					dijit.byId('connPort-'+this.strConn).setValue(objConn.port);
				}
			}
			if(objConn.uri && isString(objConn.uri)){
				if(!dijit.byId('connPort-'+this.strConn)){
					console.warn('[%s]dijit not exist!','connUri-'+this.strConn);
				}else{
					dijit.byId('connUri-'+this.strConn).setValue(objConn.uri);
				}
			}
			if(objConn.clientId && isString(objConn.clientId)){
				if(!dijit.byId('connClientId-'+this.strConn)){
					console.warn('[%s]dijit not exist!','connClientId-'+this.strConn);
				}else{
					dijit.byId('connClientId-'+this.strConn).setValue(objConn.clientId);
				}
			}
			//Subscription title pane
			dijit.byId('connSubTopic-'+this.strConn).set('store',this.subTopicHis);
			
			//Publication title pane
			dijit.byId('connPubTopic-'+this.strConn).set('store',this.pubTopicHis);
			
			//Conenction options
			var options = objConn.options;
			if(!options || isEmpty(options)){
				return;
			}
			if(options.cleanSession && isBoolean(options.cleanSession)){
				dijit.byId('connIsCleanSession-'+this.strConn).setChecked(options.cleanSession);
			}
			if(options.useSSL && isBoolean(options.useSSL)){
				dijit.byId('connUseSSL-'+this.strConn).setChecked(options.useSSL);
			}
			if(options.isHA && isBoolean(options.isHA)){
				dijit.byId('connIsHA-'+this.strConn).setChecked(options.isHA);
				// load HA list
			}
			//set HA grid
			opt = options;
			if(options.arrHA && isArray(options.arrHA.hosts) 
				&& isArray(options.arrHA.ports)
				&& options.arrHA.hosts.length !==0 
				&& options.arrHA.hosts.length === options.arrHA.ports.length)
			{
				var num = options.arrHA.hosts.length;
				for(var i=0; i<num; i++){
					this.HAMem.add({
						choose : true,
						host: options.arrHA.hosts[i],
						port: options.arrHA.ports[i]
					});
				}
			}
			
			if(options.isLWT && isBoolean(options.isLWT)){
				dijit.byId('connIsLWT-'+this.strConn).setChecked(options.isLWT);
			}
			if(options.msgLWT){
				dijit.byId('connLwtTopic-'+this.strConn).setValue(options.msgLWT.topic);
				dijit.byId('connLwtQos-'+this.strConn).setValue(options.msgLWT.qos);
				dijit.byId('connLwtIsRetain-'+this.strConn).setValue(options.msgLWT.retained);
				dom.byId('connLwtMsg-'+this.strConn).value = options.msgLWT.msg;
			}
			if(options.isLogin && isBoolean(options.isLogin)){
				dijit.byId('connIsLogin-'+this.strConn).setChecked(options.isLogin);
				//set user data
			}
			if(options.user && options.user.username &&options.user.passwd){
				dijit.byId('connUser-'+this.strConn).setValue(options.user.username);
				dijit.byId('connPasswd-'+this.strConn).setValue(options.user.passwd);
			}
				
			if(options.keepAliveInterval && isNumber(options.keepAliveInterval)){
				dijit.byId('connAlive-'+this.strConn).setValue(options.keepAliveInterval);
			}
			//no retry parameter 
			//retry by the client callback.
		},
		_updateConnectionInfo : function(){
			this.host = dijit.byId('connHost-'+this.strConn).value;
			this.port = dijit.byId('connPort-'+this.strConn).value;
			this.isUri = dijit.byId('radioUri-'+this.strConn).checked;
			this.uri = 	dijit.byId('connUri-'+this.strConn).value.trim();
			this.clientId = dijit.byId('connClientId-'+this.strConn).value.trim();
			
			//options
			this.options = {};
			this.options.cleanSession = dijit.byId('connIsCleanSession-'+this.strConn).checked;
			this.options.useSSL = dijit.byId('connUseSSL-'+this.strConn).checked;
			this.options.isHA = dijit.byId('connIsHA-'+this.strConn).checked;
			this.options.isLWT = dijit.byId('connIsLWT-'+this.strConn).checked;
			this.options.isLogin = dijit.byId('connIsLogin-'+this.strConn).checked;
			this.options.keepAliveInterval = dijit.byId('connAlive-'+this.strConn).value;
			
			if(this.options.isLWT){
				this.options.msgLWT = {};
				this.options.msgLWT.topic = dijit.byId('connLwtTopic-'+this.strConn).getValue();
				this.options.msgLWT.qos = parseInt(dijit.byId('connLwtQos-'+this.strConn).value);
				this.options.msgLWT.retained = dijit.byId('connLwtIsRetain-'+this.strConn).checked;
				this.options.msgLWT.msg = dom.byId('connLwtMsg-'+this.strConn).value.trim();
			}
			if(this.options.isHA){
				this.options.arrHA = {};
				this.options.arrHA.hosts = [];
				this.options.arrHA.ports = [];
				var selected = this.HAMem.query({choose:true});
				for(var i=0; i<selected.length; i++){
					this.options.arrHA.hosts.push(selected[i].host);
					this.options.arrHA.ports.push(selected[i].port);
				}
			}
			console.log('connection options:',this.options);
			//persist to files;
			
		},
		
		_showHisGrid : function(){
			var grid = new Grid(lang.mixin({
				id: 'gridHistroy-' + this.strConn,
				cacheClass: Cache,
				store: this.hisMem,
				structure: this.gridLayout.histroy,
				modules: [
					gridModules.ToolBar,
					gridModules.Pagination,
					gridModules.OneUIPaginationBar,
					gridModules.VScroller,
					gridModules.SelectRow,
					gridModules.ColumnResizer,
				],
				selectRowTriggerOnCell: true,
				selectRowMultiple: false
			}, {
				paginationBarGotoButton: true
			}));
			
			grid.toolBar.widget.addChild(new Button({
				showLabel: false,
				label: 'clear',
				id: 'hisClear-'+ this.strConn,
				iconClass: 'buttonDelete gray',
				onClick: dojo.hitch(this,function() {
					this.clearHistroy();
					console.log('clear histroy');
				})
			}));
			
			// row double click event
			dojo.connect(grid, "onRowDblClick", dojo.hitch(this,function(e) {
				console.log('dbclick select a row');
				try{
					var selectRow = grid.select.row.getSelected(); //id
					var item = grid.store.get(selectRow[0]);
					//dojoAlert(JSON.stringify(item));
					this.viewMessage(item);
					
				}catch(e){
					console.warn('view message exception',e);
				}
			}));
			
			grid.startup();
		
			return grid;
		},
		viewMessage : function(msg){
			var msgViewDlg = new Dialog({
				id : 'dlgCreateMon-' , 
				title : 'MessageView',
				content : "<table id='tbViewMsg' class='hidden-table'></table>",
				onCancel : function() {
					// destroy children
					this.destroyRecursive();
				},
				onShow : function(){
				}
			});
			//add content
			this.createMsgItem('Event',msg.event,'tbViewMsg');
			this.createMsgItem('Topic',msg.topic,'tbViewMsg');
			this.createMsgItem('Message',msg.message,'tbViewMsg');
			this.createMsgItem('Qos',msg.qos,'tbViewMsg');
			this.createMsgItem('Retained',msg.retained,'tbViewMsg');
			this.createMsgItem('Time',msg.time,'tbViewMsg');
			
			msgViewDlg.show();
		},
		createMsgItem : function(key,value,domTb){
			if(!isString(key) || value===undefined || value===DEFAULT_TB_STRING){
				return false;
			}
			var tr = domCreate.create('tr');
			var domLabel = domCreate.create('td',{'class':'label2'});
			
			domLabel.appendChild(domCreate.create('label',{'class':'label-font','for':'viewMsg-'+key,innerHTML:key}));
			tr.appendChild(domLabel);
			
			if('message' === key.toLowerCase()){
				var domValue = domCreate.create('td',{'colspan':6,'class':'widget2'});
				domValue.appendChild(domCreate.create('textarea',{id:'viewMsg-'+key,readonly:true,value:value,style:'width:96%'}));
				tr.appendChild(domValue);
				dom.byId(domTb).appendChild(tr);
			}else{
				var domValue = domCreate.create('td',{'class':'widget2'});
				domValue.appendChild(domCreate.create('div',{id:'viewMsg-'+key}));
				tr.appendChild(domValue);
				
				dom.byId(domTb).appendChild(tr);
				
				var text = new TextBox({
					value : value,
					style : 'width:96%',
					readOnly : true
				},'viewMsg-'+key);
			}
			return tr;
		},
		
		_showLastMsgGrid : function(){
			var grid = new Grid(lang.mixin({
				id: 'gridLastMsg-' + this.strConn,
				cacheClass: Cache,
				store: this.lastMsgMem,
				structure: this.gridLayout.lastMsg,
				modules: [
					gridModules.ToolBar,
					gridModules.Pagination,
					gridModules.OneUIPaginationBar,
					gridModules.VScroller,
					gridModules.SelectRow,
					gridModules.ColumnResizer,
				],
				selectRowTriggerOnCell: true,
				selectRowMultiple: false
			}, {
				paginationBarGotoButton: true
			}));
			
			grid.toolBar.widget.addChild(new Button({
				showLabel: false,
				label: 'clear',
				id: 'lastMsgClear-'+ this.strConn,
				iconClass: 'buttonDelete gray',
				onClick: dojo.hitch(this,function() {
					this.clearLastMsg();
				})
			}));
			
			// row double click event
			dojo.connect(grid, "onRowDblClick", dojo.hitch(this,function(e) {
				try{
					var selectRow = grid.select.row.getSelected(); //id
					var item = grid.store.get(selectRow[0]);
					//dojoAlert(JSON.stringify(item));
					this.viewMessage(item);
					
				}catch(e){
					console.warn('view message exception',e);
				}
			}));
			grid.startup();
			return grid;
		},
		
		_showHAGrid : function(){
			var grid = new Grid(lang.mixin({
				id: 'gridHA-' + this.strConn,
				cacheClass: Cache,
				store: this.HAMem,
				//store: this.lastMsgMem,
				structure: this.gridLayout.optionHA,
				modules: [
					gridModules.ToolBar,
					gridModules.Pagination,
					gridModules.OneUIPaginationBar,
					gridModules.VScroller,
					gridModules.CellWidget,
					gridModules.SelectRow,
					gridModules.Edit,
					gridModules.ColumnResizer,
					
				],
				selectRowTriggerOnCell: true,
				selectRowMultiple: false
			}, {
				paginationBarGotoButton: true
			}));
			
			grid.toolBar.widget.addChild(new Button({
				showLabel: false,
				label: 'add',
				id: 'optionHAadd-'+ this.strConn,
				iconClass: 'buttonAdd gray',
				onClick: dojo.hitch(this,function() {
					//this.clearLastMsg();
					this.addAHA({
						choose: true,
						host:'',
						port:''
					});
				})
			}));
			grid.toolBar.widget.addChild(new Button({
				showLabel: false,
				label: 'delete',
				id: 'optionHADel-'+ this.strConn,
				iconClass: 'buttonDelete gray',
				onClick: dojo.hitch(this,function() {
					//this.clearLastMsg();
					console.log('delete');
					var selected = this.HAMem.query({choose:true});
					console.log('selected items:',selected);
					this.delHAs(selected);
				})
			}));
			// row double click event
		
			grid.startup();
			return grid;
		},
		
		addAHA : function(item){
			this.HAMem.add(item);
		},
		delHAs : function(items){
			for(var i in items){
				try{
					this.HAMem.remove(items[i].id);
				}catch(e){
					console.warn('Delete HA memory exception');
				}
			}
		},
		
		
		scroll2last : function(gridx){
			var currPage = gridx.pagination.currentPage() ; // from 0
			var pageCount = gridx.pagination.pageCount(); 
			var pageSize = gridx.pagination.pageSize();
			var rowCount = gridx.rowCount();
			try{
				var viewIndex = rowCount%pageSize ? rowCount%pageSize-1 : pageSize-1
				if(currPage!==pageCount-1){
					gridx.pagination.gotoPage(pageCount-1);
				}
				gridx.vScroller.scrollToRow(viewIndex);
			}catch(e){
				console.warn('scroll to last page Exception',e);
			}
		},
		addAHistroy : function(obj){
			this.hisMem.add(obj);
			//console.log('scroll to row',this.hisGrid.rowCount()-1);
			this.scroll2last(this.hisGrid);
		},
		
		addALastMsg : function(obj){
			this.lastMsgMem.add(obj);
			this.scroll2last(this.lastMsgGrid);
		},
		clearHistroy : function(){
			this.hisMem = new Memory({data:[]});
			this.hisGrid.setStore(this.hisMem);
		},
		clearLastMsg : function(){
			this.lastMsgMem = new Memory({data:[]});
			this.lastMsgGrid.setStore(this.lastMsgMem);
		},
		/**
		*  mqtt connect
		*/
		mqttConnect : function(){
			this._updateConnectionInfo();
			
			if(this.mqttClient && this.connected ){
				return false;
			}
			if(this.options.isHA){
				try{	
					this.mqttClient = new Paho.MQTT.Client(this.host,this.port,this.clientId);
				}catch(e){
					dojoAlert(e);
					console.log('create Paho.MQTT.Client error:',e);
				}
			}else if(this.isUri){
				try{
					this.mqttClient = new Paho.MQTT.Client(this.uri,this.clientId);
				}catch(e){
					dojoAlert(e);
					console.log('create Paho.MQTT.Client error:',e);
				}	
			}else{
				try{
					this.mqttClient = new Paho.MQTT.Client(this.host,this.port,this.clientId);
				}catch(e){
					dojoAlert(e);
					console.log('create Paho.MQTT.Client error:',e);
				}	
			}
			
			this.mqttClient.onConnectionLost = dojo.hitch(this,this._onDisconnect);
			this.mqttClient.onMessageArrived = dojo.hitch(this,this._onMessageArrived);
			this.mqttClient.onMessageDelivered = dojo.hitch(this,this._onMessageDelivered);
			
			
			//get connect option
			var connectOptions = {
				cleanSession : this.options.cleanSession, 
				useSSL : this.options.useSSL,
				onSuccess : dojo.hitch(this,this._onConnect),
				onFailure : dojo.hitch(this,this._onConnectFailure)
			};
			var msgLwt = null;
			if(this.options.isLWT){
				msgLwt = new Paho.MQTT.Message(this.options.msgLWT.msg);
				msgLwt.destinationName = this.options.msgLWT.topic;
				msgLwt.qos = this.options.msgLWT.qos;
				msgLwt.retained = this.options.msgLWT.retained;
				
				connectOptions.willMessage = msgLwt;
			}
			if(this.options.isHA){
				connectOptions.hosts = this.options.arrHA.hosts;
				connectOptions.ports = this.options.arrHA.ports;
			}
			
			this.options.isLogin && (connectOptions.userName = dijit.byId('connUser-'+this.strConn).value)
				&& (connectOptions.password = dijit.byId('connPasswd-'+this.strConn).value);
			console.log('connection option',this.options.isLWT,connectOptions);
			try{
				this.mqttClient.connect(connectOptions);
			}catch(e){
				dojoAlert(e.message);
				console.warn('connect exception:',e);
			}

			dojo.publish(SAVE_EDIT_CONN,{
				id : this.strConn,
				value : {
					id : this.strConn,
					name :this.strConn,
					host : this.host,
					port : this.port,
					uri : this.uri,
					clientId : this.clientId,
					options : this.options
				}
			});
		},
		
		mqttDisconnect : function(){
			try{
				this.mqttClient.disconnect();
			}catch(e){
				dojoAlert(e.message);
				console.warn('disconnect exception:',e);
			}
		},
		
		mqttSub : function(){
			var topic = dijit.byId('connSubTopic-'+ this.strConn).getValue();
			var qos = parseInt(dijit.byId('connSubQos-'+this.strConn).getValue());
			this.currSubTopic = {
				name : topic,
				id : topic,
				qos : qos
			};
			try{
				this.mqttClient.subscribe(topic, {
					qos:qos,
					invocationContext : {topic:topic,qos:qos},
					onSuccess:dojo.hitch(this,this._onSubscribe),
					onFailure:dojo.hitch(this,this._onSubscribeFailure)
				});
			}catch(e){
				dojoAlert(e.message);
				console.warn('subscribe exception:',e);
			}
		},
		mqttUnsub : function(){
			var topic = dijit.byId('connSubTopic-'+ this.strConn).getValue();
			this.currUnsubTopic = topic;
			try{
				this.mqttClient.unsubscribe(topic,{
					onSuccess:dojo.hitch(this,this._onUnsubscribe)
				});
			}catch(e){
				dojoAlert(e.message);
				console.warn('unsubscribe exception:',e);
			}
		},
		mqttPub : function(){
			var topic = dijit.byId('connPubTopic-'+this.strConn).getValue();
			var isHex = dijit.byId('connIsMsgHex-'+this.strConn).checked;
			var strMsg = dom.byId('connPubMsg-'+this.strConn).value.trim();
			var qos = parseInt(dijit.byId('connPubQos-'+this.strConn).value);
			var isRetained = dijit.byId('connIsRetain-'+this.strConn).checked;
			this.currPubTopic = {
				name : topic,
				id : topic,
				qos : qos,
				retained : isRetained
			};
			var message = new Paho.MQTT.Message(strMsg);
			message.destinationName = topic;
			message.qos=qos;
			message.retained = isRetained;
			try{
				this.mqttClient.send(message);
			}catch(e){
				dojoAlert(e.message);
				console.warn('send message exception:',e);
			}
			console.log('publish...',this.currPubTopic);
		},
		/**
		* mqtt callback
		*/
		_onConnect : function(msg) {
			console.log("[client]:%s connected",this.clientId,msg);
			this.connected = true;
			//add a histroy;
			this.addAHistroy({
				event : HISTROY_EVENT.CONNECTED,
				topic : DEFAULT_TB_STRING,
				message : msg.errorMessage ? msg.errorMessage : DEFAULT_TB_STRING,
				qos : DEFAULT_TB_STRING,
				retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			
			query('#connClientStatus-'+this.strConn).removeClass('criticalStatus').addClass('normalStatus');
			dijit.byId('btnConn-'+this.strConn).setDisabled(true);
			dijit.byId('btnDisConn-'+this.strConn).setDisabled(false);
			dijit.byId('btnSub-'+this.strConn).setDisabled(false);
			dijit.byId('btnUnsub-'+this.strConn).setDisabled(false);
			dijit.byId('btnPub-'+this.strConn).setDisabled(false);
			
		},
		
		_onConnectFailure : function(err){
			this.connected = false;
			//add a histroy;
			this.addAHistroy({
				event : HISTROY_EVENT.DISCONNECTED,
				topic : DEFAULT_TB_STRING,
				message : err.errorMessage ? err.errorMessage : DEFAULT_TB_STRING,
				qos : DEFAULT_TB_STRING,
				retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			
			query('#connClientStatus-'+this.strConn).removeClass('normalStatus').addClass('criticalStatus');
			dijit.byId('btnConn-'+this.strConn).setDisabled(false);
			dijit.byId('btnDisConn-'+this.strConn).setDisabled(true);
			dijit.byId('btnSub-'+this.strConn).setDisabled(true);
			dijit.byId('btnUnsub-'+this.strConn).setDisabled(true);
			dijit.byId('btnPub-'+this.strConn).setDisabled(true);
			
			dojoAlert('Connect fail. ErrorMsg: '+ err.errorMessage);
			console.log('Connect fail. ErrorCode: %s, ErrorMsg: %s',err.errorCode,err.errorMessage,err);
			
			
		},
		
		_onDisconnect : function(msg) {
			console.log("[client]:%s disconnected",this.clientId,msg);
			this.connected = false;
			//add a histroy;
			this.addAHistroy({
				event : HISTROY_EVENT.DISCONNECTED,
				topic : DEFAULT_TB_STRING,
				message : msg.errorMessage ? msg.errorMessage : DEFAULT_TB_STRING,
				qos : DEFAULT_TB_STRING,
				retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			
			query('#connClientStatus-'+this.strConn).removeClass('normalStatus').addClass('criticalStatus');
			dijit.byId('btnConn-'+this.strConn).setDisabled(false);
			dijit.byId('btnDisConn-'+this.strConn).setDisabled(true);
			dijit.byId('btnSub-'+this.strConn).setDisabled(true);
			dijit.byId('btnUnsub-'+this.strConn).setDisabled(true);
			dijit.byId('btnPub-'+this.strConn).setDisabled(true);
			
			delete this.mqttClient;
			//addAHistory();
		},
		_onSubscribe : function(msg) {
			console.log("[client]:%s subscribed.[msg]: ",this.clientId,this.currSubTopic,msg);
			this.currSubTopic.subscribed = true;
			this.currSubTopic.id = this.currSubTopic.name;
			
			//add a histroy
			
			this.addAHistroy({
				event : HISTROY_EVENT.SUBSCRIBED,
				topic : this.currSubTopic.name,
				message : DEFAULT_TB_STRING,
				qos : this.currSubTopic.qos,
				retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			var item = this.subTopicHis.get(this.currSubTopic.id);
			if(!item || item.qos!==this.currSubTopic.qos){
				this.subTopicHis.put(this.currSubTopic);
			}
			this.currSubTopic = {};
		},
		_onSubscribeFailure : function(err) {
			this.subscribed = false;
			this.addAHistroy({
				event : HISTROY_EVENT.UNSUBSCRIBED,
				topic : this.currSubTopic.name,
				message : err.errorMessage ? err.errorMessage : DEFAULT_TB_STRING,
				qos : DEFAULT_TB_STRING,
				retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			console.log("subscrib fail. [ErrorCode]: %s, [ErrorMsg]: %s",err.errCode,err.errorMessage,err);
		},
		
		_onUnsubscribe : function() {
			console.log("[client]:%s unsubscribed",this.clientId);
			this.addAHistroy({
				event : HISTROY_EVENT.UNSUBSCRIBED,
				topic : this.currUnsubTopic,
				message : DEFAULT_TB_STRING,
				qos : DEFAULT_TB_STRING,
				retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			try{
				this.subTopicHis.remove(this.currUnsubTopic);
			}catch(e){
				console.log(e);
			}
			this.currUnsubTopic = null;
		},

		_onMessageArrived : function(msg) {
			console.log("[client]:%s, [received msg]: %s",this.clientId,msg.payloadString,msg);
			this.addAHistroy({
				event : HISTROY_EVENT.RECEIVED,
				topic : msg.destinationName ? msg.destinationName : DEFAULT_TB_STRING,
				message : msg.payloadString ? msg.payloadString : DEFAULT_TB_STRING ,
				qos : isNumber(msg.qos) ? msg.qos : DEFAULT_TB_STRING,
				retained : isBoolean(msg.retained) ? msg.retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});
			this.addALastMsg({
			//	event : HISTROY_EVENT.RECEIVED,
				topic : msg.destinationName ? msg.destinationName : DEFAULT_TB_STRING,
				message : msg.payloadString ? msg.payloadString : DEFAULT_TB_STRING ,
				qos : isNumber(msg.qos) ? msg.qos : DEFAULT_TB_STRING,
				retained : isBoolean(msg.retained) ? msg.retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});

		},
		
		_onMessageDelivered : function(msg){
			this.addAHistroy({
				event : HISTROY_EVENT.PUBLISHED,
				topic : msg.destinationName ? msg.destinationName : DEFAULT_TB_STRING,
				message : msg.payloadString ? msg.payloadString : DEFAULT_TB_STRING ,
				qos : isNumber(msg.qos) ? msg.qos : DEFAULT_TB_STRING,
				retained :isBoolean(msg.retained) ? msg.retained : DEFAULT_TB_STRING,
				time : dojo.date.locale.format(new Date(), {formatLength: "short"})
			});

			
			var item = {
				id : msg.destinationName,
				name : msg.destinationName,
				qos : msg.qos,
				retained : msg.retained
			}
			console.log("[client]:%s ,[delivered message]: %s, [qos]:%s",this.clientId,msg);
			this.pubTopicHis.put(item);
		   //add a history
		},
		
		
		destroy: function() {
			if(this.mqttClient&&this.connected){
				this.mqttDisconnect();
			}
			this.hisGrid.destroyRecursive();
			this.lastMsgGrid.destroyRecursive();
			this.HAGrid.destroyRecursive();
			
			var currTab = dijit.byId('conn-'+this.strConn);
			var mainTab = dijit.byId(this.parentPaneId);
			console.log(this.parentPaneId,this.strConn,currTab,mainTab);
			mainTab.selectChild(dijit.byId('connIntro'));
			if(currTab){
				mainTab.removeChild(currTab);
			}
			tab.destroyRecursive();
			
		},
		
		selfDestroy: function() {
			if(this.mqttClient&&this.connected){
				this.mqttDisconnect();
			}
			this.hisGrid.destroyRecursive();
			this.lastMsgGrid.destroyRecursive();
			this.HAGrid.destroyRecursive();
			
		//	var currTab = dijit.byId('conn-'+this.strConn);
		//	var mainTab = dijit.byId(this.parentPaneId);
		//	console.log(this.parentPaneId,this.strConn,currTab,mainTab);
		//	mainTab.selectChild(dijit.byId('connIntro'));
		//	if(currTab){
		//		mainTab.removeChild(currTab);
		//	}
			//currTab.destroyRecursive();
			
		}
		
	});
	return TabConn;
});

