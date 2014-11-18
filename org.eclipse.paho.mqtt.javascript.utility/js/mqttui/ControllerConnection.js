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

define("mqttui/ControllerConnection",["dojo/_base/declare",
	"dojo/i18n!mqttui/nls/resource",
	"dojo/_base/lang",
	"dojo/_base/event",
	"dojo/on",
    "dojo/parser",
	"dojo/ready",
	"dojo/topic",
	"dojo/dom",
	'dojo/dom-construct',
	
	"dijit/form/Button",
	"dijit/form/CheckBox",
	"dijit/form/TextBox",
	"dijit/form/Textarea",
    "dijit/form/Select",
    "dijit/form/ComboBox",
	"dijit/Toolbar",
	"dijit/layout/ContentPane",
	"dijit/layout/BorderContainer",
	"dijit/layout/TabContainer",
	"dojo/store/Memory",
	"dojo/store/Observable",
	"dijit/tree/ObjectStoreModel",
	"dijit/Tree",	
	"dijit/Menu", 
	"dijit/MenuItem",
	"dijit/InlineEditBox",
	
	//mqttui widget
	"mqttui/TabConn"
	
	
	
],function(declare,resource,lang,event,on,parser,ready,topic,dom,domCreate,
			Button,CheckBox,TextBox,Textarea,Select,ComboBox,Toolbar,
			ContentPane,BorderContainer,TabContainer,
			Memory,Observable,ObjectStoreModel,Tree,Menu,MenuItem,InlineEditBox,
			TabConn
		//	MonChart,TabMonitor,TabMqtt,TabMessage,CreateEditConn,CreateMon,EditMon
			){
    var controllerConnection = declare("mqttui.ControllerConnection",null,{
        constructor : function(){
		this.CONN_COUNT = 1;
			this.TAB_CONN = {};
			this.TOPICS = {};
			this._subTopics();

        },
		
		/*
        * desc : remove or set tree data;
        * */
		_removeTreeChildren : function(obStore){
			var children = obStore.getChildren({id:'root'});
			dojo.forEach(children,function(item){
				obStore.remove(item.id);
			});
		},
		_removeTreeItem : function(obStore,item){
			return obStore.remove(item.id);
		},
		_renameTreeItem : function(obStore,item,newName){
			//var children = obStore.getChildren({id:'root'});
			if(obStore.get(newName)){
				//name exist (name == id);
				dojoAlert('name is already exist');
			}else{
				obStore.remove(item.id);
				var newItem = item;
				newItem.name = newName;
				newItem.id = newName;
				obStore.add(newItem);
			}
		},
		_addTreeItem : function(obStore,item){
			return obStore.add(item);
			
		},
		
		_setTreeChildren : function(obStore,arrData){
			if(dojo.isArray(arrData)&&arrData.length>0){
				dojo.forEach(arrData,function(item){
					item.parent = 'root';
					//console.log(item);
					obStore.add(item);
				})
			}
		},
		
        /*
        * desc : create left nav and click event callback
        * */
		createNavConn : function() {
			var tree = dijit.byId('connTree');
			if(tree){
				dijit.byId('connTree').destroyRecursive();
			}
			
			// tree menu;
			var menu = dijit.byId('connTreeMenu');
			if(menu){
				menu.destroyRecursive();
			}
			
			dom.byId('navConn').appendChild(domCreate.create('div',{id:'connTree'}));
			var that = this;
			var connections = this._getCookie();
			console.log('get conn form cookie',connections);
			if(connections){
				this.buildNavTree(connections);
				//this.CONN_COUNT = 
			}else{
				//get demo connection
				restGet( DATA_CONNS,function(response,ioArgs) {
						that.CONN_COUNT = response.count;
						that.buildNavTree(response.connections);
						dojo.cookie(COOKIE_KEY,JSON.stringify(response.connections));
						console.log('data connections',response,response.count);
					},function(response,ioArgs){
						console.warn('get connections data error');
					}
				);
			}
			//newConnection link
			dojo.connect(dom.byId('aNewConn'),'onclick',dojo.hitch(this,function(){
				this.showCreateConnBox();
			}));
			
		},
		
	    /*
	    * desc : create left tree ;
	    *       add onclick event to create connection tab;
	    * */
		buildNavTree : function (objConns){
			var treeData = [];
			
			for(var key in objConns){
				var item = objConns[key];
				item.parent = 'root';
				item.name = key;
				treeData.push(item);
			}
			
			treeData.push({'id':'root','child':'yes'});
			
			var memStore = new Memory({
				data : treeData,
				getChildren : function(object){
					// Add a getChildren() method to store for the data model where
					// children objects point to their parent (aka relational model)
					return this.query({parent: object.id});
				},
				hasChild: function(object) {
					return object.child == 'yes' ? true : false;
				}
			});
			
			this.navConnStore = new Observable(memStore);
			var navModel = new ObjectStoreModel({
				store : this.navConnStore,
				query : {
					"id" : "root"
				},
				mayHaveChildren: function(item){
					if (this.store.hasChild(item)) {
						return true;
					}
					else {
						return false;
					}
			}});
			
			var connTree = new Tree({
				"class" : 'treeStyle',
				model : navModel,
				showRoot : false,
				onOpenClick : true,
				//overwrite the dijit.Tree onkeypress callback to avoid an error in _onLetterKeyNav
				_onKeyPress : function(node,evt){
					return;
				},
				onBlur : function(evt){
				},
				onDblClick : lang.hitch(this,function(item,node,evt){
					console.debug('doublue click tree item',item);
					this.openAConnTab('tabConn',item);
				})
				//onClick : dojo.hitch(this,function(item){
				//	console.log(item,item.name,item.options);
				//	//publish open or choose a tab
				//})
			}, "connTree");
			
			connTree.startup();
			this.createConnTreeMenu();
		},
		
		/*
		* desc : create connection right click menu
		* */
		createConnTreeMenu : function(){
			var self = this;
			var treeMenu = new Menu({
				id : 'connTreeMenu',
				targetNodeIds : ["connTree"],
				selector: ".dijitTreeNode",
				style : "display:none"
			});
						
			treeMenu.addChild( new dijit.MenuItem({
				id:'editConn',
				label : resource.navigation.renameItem,
				iconClass : "dijitIconEditTask",
				onClick : function(){
					var tn = dijit.byNode(this.getParent().currentTarget);
					var treeItem = tn.item;
					
					var domNode = tn.domNode;
					var editBoxNode = dojo.create("span");
					dojo.place(editBoxNode,domNode,"after");
					dojo.addClass(domNode,"dijitHidden");
					
					var editBox = new InlineEditBox({
						width : 'auto', //this needs to be set to a value or auto to keep other tabs visible
						autoSave : false,
						id:'edit-'+treeItem.name,
						buttonCancel: 'cancel',
						buttonSave : 'save',
						value :treeItem.name,
						originalValue : treeItem.name,
						rename: lang.hitch(this, function(evt, editBox) {
							console.log('renameing',editBox,treeItem,editBox.value);
							editBox.destroy();
							dojo.removeClass(domNode, "dijitHidden");
							//publish store connections persistence store
							dojo.publish(SAVE_RENAME_CONN,{
								oldKey : treeItem.id,
								newValue : {
									id:editBox.value,
									name : editBox.value
								}
							})
							//publish rename tab 
							self.closeAConnTab(treeItem.id);

							self._renameTreeItem(self.navConnStore,treeItem,editBox.value);
						}),
						onBlur : function(evt){
						},
						onCancel : function(evt) {
							editBox.destroy();
							dojo.removeClass(domNode, "dijitHidden");
						},
						onChange : function(evt){
							this.destroy();
							this.rename(evt, this);
						}
					}, editBoxNode);
					editBox.edit();
					dojo.query('.dijitTreeContainer .dijitButton').addClass('smallBtn');
				}
			
			}));
			//del connection
			treeMenu.addChild( new dijit.MenuItem({
				id:'delConn',
				label : resource.navigation.deleteItem,
				iconClass : "dijitEditorIcon dijitEditorIconDelete",
				onClick : function() {
					
					dojoConfirm(resource.confirm.delConn, dojo.hitch(this,function() {
						var tn = dijit.byNode(this.getParent().currentTarget);
						var treeItem = tn.item;
						console.log('menu click for item', treeItem);
						if(! self._removeTreeItem(self.navConnStore,treeItem)){
							dojoAlert(resource.alert.errDelConn);
							console.warn('delete connection error');
						}else{
							//publish delete connection persistence store
							dojo.publish(SAVE_DEL_CONN,{id:treeItem.id});
							//close tab if it is open
							self.closeAConnTab(treeItem.id);
							
						}
						
					}));
				}
			
			}));
		},
		
		
	    /*
	    * desc : show 'create/edit connection ' edit box
	    *
	    * */
		showCreateConnBox : function(connName) {
			do{
				this.CONN_COUNT++;
			}while(this.navConnStore.get(resource.navigation.defaultConnName+this.CONN_COUNT))
			
			var defaultName = resource.navigation.defaultConnName+this.CONN_COUNT;

			var treeNodeCon = dojo.query('.dijitTreeContainer [role=tree]');
			var lastNode = treeNodeCon.query('.dijitTreeNode:last-child')[0];
		//	console.log('last tree node',lastNode);
			var editBoxNode = dojo.create("span");
			dojo.place(editBoxNode,lastNode,"after");
			//dojo.addClass(domNode,"dijitHidden");
			
			var self = this;
			var editBox = new InlineEditBox({
				width : 'auto', //this needs to be set to a value or auto to keep other tabs visible
				autoSave : false,
				buttonCancel: 'cancel',
				buttonSave : 'save',
				//value : defaultName,
				//noValueIndicator : defaultName,
				//originalValue : resource.navigation.defaultConnName,
				rename: function(evt, editBox) {
					editBox.destroy();
					var item = {
						id : editBox.value,
						name : editBox.value,
						parent : 'root'
					};
					self._addTreeItem(self.navConnStore,item);
					//self.connNavStore.add(item);
					//publish open tab 
					//publish store connections persistence store
					console.log('save add');
					dojo.publish(SAVE_ADD_CONN,{
						id : editBox.value,
						name : editBox.value
					});
					
					
				},
				onCancel : function(evt) {
					console.debug('canceling');
					editBox.destroy();
					//dojo.removeClass(domNode, "dijitHidden");
				},
				onChange : function(evt){
					this.destroy();
					console.debug('changing',this.value);
					this.rename(evt, this);
				}
			}, editBoxNode);
			editBox.edit();
			dojo.query('.dijitTreeContainer .dijitButton').addClass('smallBtn');
		},
		
	   
				
		/*
		* desc : create connection tab
		* */
		openAConnTab : function(parentTabId,objConn){
			var mainTab = dijit.byId(parentTabId);
			if(!isObject(mainTab)){
				console.warn('parentTabId not exist');
				return;
			}
			//console.log('...',this.TAB_CONN[objConn.name]);
			if(dijit.byId('conn-'+objConn.name)){
				mainTab.selectChild(dijit.byId('conn-'+objConn.name));
			}else{
				this.TAB_CONN[objConn.name] = new TabConn({
					parentPaneId : parentTabId,
					objConn:objConn
					//onClose : dojo.hitch(this,function(){
					//	console.log('closing the tab');
					//	this.closeAConnTab(objConn.name);
					//})
				});
				this.TAB_CONN[objConn.name].startup();
			
			}
		},
		
		closeAConnTab : function(tabName){
			if(this.TAB_CONN[tabName]){
				this.TAB_CONN[tabName].destroy();
				delete this.TAB_CONN[tabName];
			}else{
				console.log('tab %s not open',tabName);
			}
		},
		
		
		/** subscribe get all cookie items as persistence*/
		_getCookie : function(){
			var connections = dojo.cookie(COOKIE_KEY);
			console.log('connections from cookie',connections);

			if(connections){
				return JSON.parse(connections);
			}else{
				return false;
			}
			
		},
		
		_getCookieExpire : function(){
			var time = new Date();
			var timeStamp = time.getTime() + COOKEI_EXPIRE;
			time.setTime(timeStamp);
			var expire = time.toGMTString();
			return expire;
		},
		_setAllCookie : function(json){
			dojo.cookie(COOKIE_KEY,JSON.stringify(json),{expires:this._getCookieExpire()});
		},
		_setOneCookie : function(key,jsonValue){
					
			var connections = this._getCookie();
			if(connections){
				connections[key] = jsonValue;
			}else{
				connections = {};
				connections[key] = jsonValue;
			}
			console.log('set',key,jsonValue,connections);

			dojo.cookie(COOKIE_KEY,JSON.stringify(connections),{expires:this._getCookieExpire()});

			
		},
		
		_delOneCookie : function(key){
			var connections = this._getCookie();
			if(connections[key]){
				delete connections[key];
				dojo.cookie(COOKIE_KEY,JSON.stringify(connections),{expires:this._getCookieExpire()});
			}
			
			//dojo.cookie(COOKIE_KEY,null,{expires:-1});
		},
		_renameOneCookie : function(oldKey,newKey){
			var connections = this._getCookie();
				console.log('rename',oldKey);
			if(connections[oldKey]){
				var value = connections[oldKey];
				value.id = newKey;
				value.name = newKey;
				this._delOneCookie(oldKey);
				this._setOneCookie(newKey,value);
			}else{
				this._setOneCookie(newKey,{id:newKey,name:newKey});
			}
		},
		
		_subTopics : function(){
			//create a connection
			this.TOPICS['saveAddConn'] = dojo.subscribe(SAVE_ADD_CONN,dojo.hitch(this,function(args){
				this._setOneCookie(args.id,args);
			}));
			//del a connection
			this.TOPICS['saveDelConn'] = dojo.subscribe(SAVE_DEL_CONN,dojo.hitch(this,function(args){
				this._delOneCookie(args.id);
			}));
			//edit a connection
			this.TOPICS['saveEditConn'] = dojo.subscribe(SAVE_EDIT_CONN,dojo.hitch(this,function(args){
				this._setOneCookie(args.id,args.value);
			}));
			//rename
			this.TOPICS['saveRenameConn'] = dojo.subscribe(SAVE_RENAME_CONN,dojo.hitch(this,function(args){
				this._renameOneCookie(args.oldKey,args.newValue.id);
			}));
			
		},
		
		_subscribeAConn : function(connName){
			this.SUBSCRIBES.updateConnMonitors[connName] = dojo.subscribe(DOJO_TOPICS("RefreshConnMonitor",connName),dojo.hitch(this,function(args){
				if(args){
					this.showMonitors(connName,args.strMsg);
				}else{
					this.showMonitors(connName);
				}
			}));
			this.SUBSCRIBES.ShowDlgCreateMon[connName] = dojo.subscribe(DOJO_TOPICS("ShowDlgCreateMon",connName),dojo.hitch(this,function(args){
				this.showCreateMonDialog(connName);
			}));
			this.SUBSCRIBES.ShowDlgEditMon[connName] = dojo.subscribe(DOJO_TOPICS("ShowDlgEditMon",connName),dojo.hitch(this,function(args){
				if(args){
					this.showEditMonDialog(connName,args.monName);
				}else{
					console.warn('monitor name undefined');
				}
			}));
			
			
		},
		
		
		
		test : function(){
			console.log('testing in ControllerConnection object...');
		}

    });

    return controllerConnection;
});
