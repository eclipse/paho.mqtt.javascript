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
var restGet = function(url,success,error){
	return dojo.xhrGet({
		url : url,
		headers:{
			'Accept' : 'application/json',
			'Content-Type': 'application/json'
		},
		preventCache : true,
		handleAs:"json",
		load : function(response,ioArgs){
			success(response,ioArgs);
		},
		error : function(response,ioArgs){
			console.log(response,ioArgs);
			error(response,ioArgs);
		}
		
	});
};

var restPost = function(url,jsonObj,success,error){
	return dojo.xhrPost({
		url : url,
		headers:{
			'Accept' : 'application/json',
			'Content-Type': 'application/json'
		},
		postData:dojo.toJson(jsonObj),
		handleAs:"json",
		load : function(response,ioArgs){
			success(response,ioArgs);
		},
		error : function(response,ioArgs){
			error(response,ioArgs);
		}
		
	});
};


/********/
function toSecondNum(str) {
	switch (str.toString().charAt(str.length - 1)) {
	case 's':
		return parseFloat(str);
	case 'm':
		return parseFloat(str) * 60;
	case 'h' :
		return parseFloat(str) * 3600;
	case 'd':
		return parseFloat(str) * 86400;
	default :
		return parseFloat(str);
	}
};
/*
 * desc : seperate time '11s' to '11' and 's'
 */
function getTimeNum(str){
	return str.slice(0,str.length-1);
}
function getTimePostfix(str){
	return str.toString().charAt(str.length-1);
}

/*desc: check object type
 * */
function isArray(arr){
	var type = Object.prototype.toString.call(arr).slice(8,-1);
	return arr!==undefined && arr!==null && type==='Array';
}
function isNumber(obj){
	var type = Object.prototype.toString.call(obj).slice(8,-1);
	return obj!==undefined && obj!==null && type==='Number'; 
};
function isBoolean(obj){
	var type = Object.prototype.toString.call(obj).slice(8,-1);
	return obj!==undefined && obj!==null && type==='Boolean'; 
};
function isString(str){
	var type = Object.prototype.toString.call(str).slice(8,-1);
	return str!==undefined && str!==null && type==='String'; 
};

function isObject(obj){
	var type = Object.prototype.toString.call(obj).slice(8,-1);
	return obj!==undefined && obj!==null && type==='Object'; 
};
function isEmpty(obj){
	if(!obj){
		return true;
	}
	for(var n in obj){
		return false;
	}
	return true;
};

/**
* dialog :alert
*/
function dojoAlert(msg){
	//alert(msg);
	msg =  "<div class='alert-text'>"+msg+"</div>";
	var content = dojo.create('div');
	var domMsg = dojo.create('div',{
		'class' : 'messageSummary',
	})

	domMsg.appendChild(dojo.create('span',{
		innerHTML : "<img class='messageWarningIcon' src='images/blank.gif'  alt='Warning'>"
	}));

	domMsg.appendChild(dojo.create('span',{
		innerHTML : msg,
		'class' : 'messageDescription'
	}))

	var domAction = dojo.create('div',{
		'class' : 'messageDialogFooter'
	});
	domAction.appendChild(dojo.create('div',{id:'btnCloseAlert','class':'messageAction'}));

	content.appendChild(domMsg);
	content.appendChild(domAction);


	var alertDialog = dijit.byId("alertDialog");
	if(!alertDialog){
		require(["dijit/Dialog","dijit/form/Button"],function(Dialog,Button) {
				var alertDialog = new Dialog({
					id : "alertDialog",
					class : 'ModalDialog',
					title : 'Alert',
					style: "width:400px;background-color:#FFFFFF",
					type : 'warning',
					content : content,
					//info : 'detail',
					onHide : function() {
						this.destroyRecursive();
					}
				});
				var btnClose = new Button({
					label : 'Close',
					'class' : 'messageAction',
					onClick : function  () {
						alertDialog.destroyRecursive();
					}
				},'btnCloseAlert');
				//alertDialog.startup();
				alertDialog.show();
		});
	}else{
		alertDialog.show();
	}

};


/* desc : confirm dialog
 * 
 * */
function dojoConfirm(text,callBack){
	//alert(msg);
	msg =  "<div class='alert-text'>"+text+"</div>";
	var content = dojo.create('div');
	var domMsg = dojo.create('div',{
		'class' : 'messageSummary',
	})

	domMsg.appendChild(dojo.create('span',{
		innerHTML : "<img class='messageConfirmationIcon' src='images/blank.gif'  alt='Warning'>"
	}));

	domMsg.appendChild(dojo.create('span',{
		innerHTML : msg,
		'class' : 'messageDescription'
	}))

	var domAction = dojo.create('div',{
		'class' : 'messageDialogFooter'
	});
	domAction.appendChild(dojo.create('div',{id:'btnCloseConfirm'}));
	domAction.appendChild(dojo.create('div',{id:'btnOkConfirm'}));

	content.appendChild(domMsg);
	content.appendChild(domAction);
	//require([ "idx/widget/ConfirmationDialog", "dojo/i18n!mqttui/nls/resource"],function(ConfirmationDialog, resource){
	require(["dijit/Dialog","dijit/form/Button"],function(Dialog,Button) {
		var question = dijit.byId("confirmationDialogQuestion");
		if(!question){
			question = new Dialog({
				id: "confirmationDialogQuestion",
				class : 'ModalDialog',
				title : 'Confirm',
				style: "width:400px;background-color:#FFFFFF",
				content : content,
				onHide : function() {
					this.destroyRecursive();
				}
			});
			var btnOk = new Button({
				label : '&nbspO&nbspK&nbsp',
				'class' : 'messageAction',
				onClick : function  () {
					callBack();
					question.destroyRecursive();
				}
			},'btnOkConfirm');

			var btnClose = new Button({
				label : 'Close',
				'class' : 'messageAction',
				onClick : function  () {
					question.destroyRecursive();
				}
			},'btnCloseConfirm');

			question.show();

		}else{
			question.show();
		}
	
	});
}
