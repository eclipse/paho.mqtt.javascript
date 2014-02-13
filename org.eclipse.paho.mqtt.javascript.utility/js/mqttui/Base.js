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
 
/** DEFAULT VAULE*/
var DEFAULT_TB_STRING = '----';
var STATUS_RUNNING = 'Running';
var STATUS_OK = 'OK';
var COOKIE_KEY = 'MqttUtility';
var COOKEI_EXPIRE = 3600*24*30 ;  // one month
	
var HISTROY_EVENT = {
	CONNECTED : 'Connected',
	DISCONNECTED : 'Disconnected',
	SUBSCRIBED : 'Subscribed',
	UNSUBSCRIBED : 'Unsubscribed',
	PUBLISHED : 'Published',
	RECEIVED : 'Received'
};
/**Topic string*/
var SAVE_ADD_CONN = 'save/conn/add';
var SAVE_DEL_CONN = 'save/conn/del';
var SAVE_EDIT_CONN = 'save/conn/edit';
var SAVE_RENAME_CONN = 'save/conn/rename';

var GET_ALL_COOKIE = '/cookie/get/all';
var SET_ONE_COOKIE = '/cookie/set/one';
var DEL_ONE_COOKIE = '/cookie/del/one';

/********URL HEADER PARAM****/
var RESPONSE_HEADER = {
	'AVAILABLE' : 'Available',
	'REASON' : 'Reason'
};

/** define url 
 * */
var DATA_CONNS = 'data/connections.json';


