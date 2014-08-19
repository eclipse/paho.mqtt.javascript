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
 *    Tang Zi Han - initial gridx definition 
 *******************************************************************************/
define([
	'gridx/modules/Focus',
	'gridx/modules/ColumnResizer',
	'gridx/modules/VScroller',
	'gridx/modules/VirtualVScroller',
	//'idx/gridx/modules/Sort',
	'gridx/modules/select/Row',
//	'gridx/modules/pagination/Pagination', //gridx 1.8 module path
//	'gridx/modules/filter/Filter', 		//gridx 1.8 module path
	'gridx/modules/Pagination',
	'gridx/modules/Filter',
	'gridx/modules/CellWidget',
	'gridx/modules/RowHeader',
	'gridx/modules/IndirectSelect',
	'gridx/modules/ToolBar',
	'gridx/modules/Edit',
	'gridx/modules/pagination/PaginationBar'
], function(
	Focus, ColumnResizer, VScroller,VirtualVScroller,
	SelectRow, Pagination, Filter, CellWidget, 
	RowHeader, IndirectSelect,
	ToolBar,Edit, OneUIPaginationBar){
return {
	Focus: Focus,
	ColumnResizer: ColumnResizer, 
	VScroller : VScroller,
	VirtualVScroller: VirtualVScroller,
	SelectRow: SelectRow,
	Pagination: Pagination,
	Filter: Filter,
	CellWidget: CellWidget,
	RowHeader: RowHeader,
	IndirectSelect: IndirectSelect,
	ToolBar: ToolBar,
	Edit : Edit,
	OneUIPaginationBar: OneUIPaginationBar
};
});
