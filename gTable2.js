/*	gTable v2 by Gilles St. Cyr � 2008
	
	An advanced and full-featured javascript table with easy setup. Takes input either in the form of javascript
	or a pre-existing HTML table. 

	Things to do:
	- Additional Documentation	
	- Add custom sort orders (ie: Low, Medium, High instead of Medium, Low, High (Alphabetical)
	+ Custom column types (String, Date, Number, Currency, List)
	- Optimize drawTable() by post processing.
	- Optimize multisort (skip already sorted columns)

*/
//var gTableScriptName = /gTable2.js.php/;
// ========================================== //
var m, gTablePath = '';

//if (!(m = document.scripts)) m = document.getElementsByTagName('script');
//for (var i=0; i < m.length; i++) if(m[i].src && m[i].src.match(gTableScriptName)) gTablePath = m[i].src.substring(0,m[i].src.lastIndexOf('/')+1);

var gTable = Class.create();

gTable.DefaultOptions = {
	className 				: 'gTable',
	data					: [],			// Holds the table Data [{key:'Value', key2:'Value2'}, {key:'Value',key2:'Value2'}]
	headers					: {},			// Object in the form: {header_key:'Header Title', header2:'Title 2'} (for JSON data input)
	columns					: [],			// Array of currently displayed columns and their order
	order					: [],			// Slightly redundant, basically a copy of headers but as an array
	sortTerms				: [],			// Array of current Sort Terms [[key,'asc'],[key2,'desc']]
	filters					: {},			// Object containing filter data {key:[grep1, grep2]}
	conditions				: {}, 			// Conditions for adding properties cells. eg: 'username':{'comparison':'==', 'value':'gstcyr','property':{'name':'style','value':'color:green'} },
	rowConditions			: {},			// Apply class to a row when a value meets a criteria. eg: {key : {operator:'==', value:1, class:'rowClass'}
	colHeaders				: true,			// Whether or not to show column Headers (not yet implemented) 
	colTypes				: {},			// 	{name:'String', date:'Date', total:'Number', category:'List'} (not yet implemented)
	rowHeaders				: false,		// (not yet implemented)
	colTotals				: false,		// (not yet implemented)
	subTotals				: false,			// Subtotals of first Column in Sort Order (default setting - user customizable from context menu)
	sortableCols			: true,			// (not yet implemented as an option - defaults to true)
	filterCols				: true,			// (not yet implemented as an option - defaults to true)
	footer					: true,			// Whether or not to show the footer
	showHelp				: true,			// Whether or not to show the help link
	stripedRows			 	: true,			// Whether or not to stripe the rows
	stripedRowsClassNames	: ['row1','row2'], // create your own patters, ie: [row1, row2, row3, row2, row1]. Each className requires a CSS declaration
	moveableCols			: true,			// Allows user to re-arrange column order
	moveableWait			: 300, 			// milliseconds before column becomes moveable
	mouseOverRows			: true,			// Gives a mouse-over effect on rows
	mouseOverCells			: false,		// Gives a mouse-over effect on individual cells (not yet implemented)
	onRowClick				: null,			// A javascript snippet to run when a row is clicked. Can use variables in the form %row_key%. If data source is a pre-existing table, keys are of the form c0, c1, c2, etc..
	useCookies				: true			// Save table preferences using cookies. Requires unique Table ID.
}

// 	ADD Column Types [String, List, Date, Number, Currency, etc...] and Appropriate Filter Options

gTable.addMethods({
	_active : null,
	
	initialize: function(element){
		var self = this;
		
		this.injectCSS();
		
		this.options = Object.extend(Object.extend({},gTable.DefaultOptions), arguments[1] || {});
		
		this.table = $(element);
		this.theader = this.table.tHead || this.table.createTHead();

		this.tfooter = this.table.createTFoot();
		this.tbody = this.table.tBodies[0];
		if(typeof(this.tbody)=='undefined'){
			this.theader.insert({after:"<tbody></tbody>"});
			this.tbody = this.table.tBodies[0];
		}

		Event.observe(this.table,'mouseover',function(){ gTable._active = self });

		if(this.table.rows.length != 0 && !this.options.data.length){
			this.dataFromTable();
		}else{
			if(this.options.data){ this.dataFromJSON(this.options.data);	}	
		}

		if(this.options.useCookies) this.loadCookies();

		if(this.options.columns.length==0) for(key in this.options.headers) this.options.columns.push(key);
		if(this.options.order.length==0) for(key in this.options.headers) this.options.order.push(key);
		
		//console.log(this.options);

		this.drawTable();
			
		Event.observe(document,"click",this.handleClick.bindAsEventListener(this));
		//Event.observe(document,"contextmenu",this.handleRightClick.bindAsEventListener(this));
		Event.observe(document,"mousedown",this.handleMouseDown.bindAsEventListener(this));
		Event.observe(document,'keypress',this.handleKeyPress.bindAsEventListener(self));		
		
		if(this.options.useCookies)
			Event.observe(window,"beforeunload",this.saveCookies.bindAsEventListener(this));
		else
			Cookie.erase('gTableSaved_'+this.table.id);
			
	},
	injectCSS : function(){
		var links = document.getElementsByTagName('link');
		for(var i=0; i<links.length; i++){
			if(links[i].href.indexOf('gTable2.css') >=0 ) return;
		}
		var css = document.createElement('link');
		css.type = 'text/css';
		css.rel = 'stylesheet';
		css.href = 'js/gTable/gTable2.css';
		document.getElementsByTagName('head')[0].appendChild(css);

	},
	outputCSS: function(){
		if($('gTable_CSS')) return;
		var css = new Element('style',{
			'id':'gTable_CSS',
			'type':'text/css'	
		});
		css.innerHTML ="#gTable_contextMenu ul{ "+
						"	list-style:none;	"+
						"	font-family:Geneva, Arial, Helvetica, sans-serif; "+
						"	font-size:11.5px; "+
						"	padding-left:20px; "+
						
					"	} 	"+
					"	#gTable_contextMenu li{	"+
					"	"+
					"	}";
		$(document.body).insert({top:css});					
	},
	
	handleClick: function(e){
		var self = this;
		var target = $(e.target);
		if(this.helpWindow) this.helpWindow.hide();
		if(!target.descendantOf(this.contextMenu.menu)){
			if(this.contextMenu.menu.visible()) this.contextMenu.hideMenu();	
		}
	},
	
	handleRightClick: function(self,e){
		//var self = this;
		/* var target = $(e.target);
		var f = $A(this.theader.rows[0].cells).find(function(h){
			var cO = h.cumulativeOffset();
			console.log(cO.left, cO.left+h.offsetWidth, cO.top, cO.top+h.offsetHeight, Event.pointerX(e), Event.pointerY(e));
			if( Position.within( h,Event.pointerX(e),Event.pointerY(e))){	
				self.contextMenu.showMenu(e,h);
				e.stop();
				return true;
			}
		}); */
		self.contextMenu.showMenu(e,this);
		e.stop();
		
		//if(!f) self.contextMenu.hideMenu(); 
	},
	
	handleMouseDown:function(e){
		//console.log('handleMouseDown');
	
	
	},
	
	handleKeyPress:function(e){
		var key = e.charCode||e.keyCode;
		if(this.contextMenu.menu.visible() && !this.contextMenu.links.addFilter.hasClassName('over')){
			if(key==83||key==115) this.addSort(e,null);
			if(key==82||key==114) if(!this.contextMenu.links.removeSort.hasClassName('disabled')) this.removeSort(); else return;
			this.contextMenu.menu.hide();
		}
		
	},
	
	dataFromTable: function(){
		if(this.theader.rows[0].cells.length && this.options.colHeaders){
			for(var i=0; i<this.theader.rows[0].cells.length; i++){
				this.options.headers['c'+i] = this.theader.rows[0].cells[i].innerHTML;
			}
		}
		if(this.tbody.rows.length != 0){
			for(i=0;i<this.tbody.rows.length;i++){
				this.options.data[i] = {};
				for(var j=0;j<this.tbody.rows[i].cells.length;j++){
					key = 'c'+j;
					this.options.data[i][key] = this.tbody.rows[i].cells[j].innerHTML;
				}
			}
		}
		this.contextMenu = new gTable_Menu(this);
	},
	
	dataFromJSON: function(data){
		if((typeof(data)).toLowerCase()=="string")
			data = data.evalJSON();

		//console.log(this.options.headers,Object.keys(this.options.headers).length);
		if(!this.options.headers||!Object.keys(this.options.headers).length)
			if(this.options.colHeaders)
				this.options.headers = data.shift();
						
		this.options.data = data;

		if(!this.options.columns.length){
			this.options.columns = [];
			this.options.order = [];
			for(key in this.options.headers){
				this.options.columns.push(key);
				this.options.order.push(key);
			}
		}
		this.reSort();
		this.contextMenu = new gTable_Menu(this);	
		
	},
	
	reSort: function(){
		if(this.options.data.length && this.options.sortTerms.length) 
			this.multisort(this.options.data,this.options.sortTerms);
	},
	
	addSort: function(e,col){
		var rClick = this.contextMenu.menu.visible();
		if(!col) col = this.contextMenu._column;
		if(e.target.tagName == 'DIV' && this.options.sortTerms.length > 0 && this.options.sortTerms[0][0]!=col){
			this.clearSort();
		}
		if(this.options.sortTerms.length==0) this.options.sortTerms.push([col,'asc']);
		else{
			var found = false;
			for(var i=0; i<this.options.sortTerms.length; i++){
				if(this.options.sortTerms[i][0]==col){ 
					this.options.sortTerms[i][1] = this.options.sortTerms[i][1]=='asc'?'desc':'asc'; 
					found = true;
					break;
				}
			}
			if(!found) this.options.sortTerms.push([col,'asc']);
		}
		
		this.multisort(this.options.data,this.options.sortTerms);
		
		this.contextMenu.links.clearSort.fire('menu:enable');
		this.drawTable();	
	},
	
	removeSort: function(c){
		c=c||this.contextMenu._column;
		this.options.sortTerms = this.options.sortTerms.reject(function(s){ return s[0]==c });
		if(this.options.sortTerms.length==0) this.contextMenu.links.clearSort.fire('menu:disable'); 
		this.drawTable();
		
	},
	
	clearSort: function(){
		this.options.sortTerms = [];
		this.contextMenu.links.clearSort.fire('menu:disable');
		this.drawTable();
		this.contextMenu.hideMenu();
	},
	
	addFilter: function(){
		var data = this.options.data;
		var col = this.contextMenu._column;
		var grep = this.contextMenu.addFilterInput.value;
		this.contextMenu.addFilterInput.value = '';
		var ogrep = grep;
		if(grep.match(/^[\d\.]+$/)){ grep = new RegExp('\\b'+grep+'\\b'); }
		else if(typeof grep == 'string') grep = new RegExp(grep,"i");
		grep.orig = ogrep;
		if(typeof(this.options.filters[col])=='undefined'){ this.options.filters[col] = [];}
		this.options.filters[col].push(grep);
		this.filterData();
		
	},
	
	removeFilter: function(col,grep){
		this.options.filters[col] = this.options.filters[col].reject(function(f){return f.orig==grep  });
		this.filterData();
	},
	
	filterData: function(){ 
		var data = this.options.data;
		for(var i=0,len=data.length;i<len;i++){	
			data[i]['_f'] = false;
			for(key in this.options.filters){
				this.options.filters[key].each(function(f){		
					if(!(''+data[i][key]).match(f)) data[i]['_f'] = true;
				});				
			}
		}
		this.drawTable();
	},
	
	drawHeaders: function(){
		var self = this;
		if(this.theader.rows.length != 0) this.theader.deleteRow(0);
		this.theader.insertRow(0);
		var str='';
		for(var i=0;i<this.options.columns.length;i++){
			if(!this.options.headers[this.options.columns[i]]){
				this.options.columns = this.options.columns.without(this.options.columns[i]);
				continue;
			}
			if(term = this.options.sortTerms.find(function(s){return s[0]==this.options.columns[i]}.bind(this))){
				var j = this.options.sortTerms.indexOf(term)+1;
				if(term[1]=='asc') str += "<span>&#x25B2;"+(j)+"</span>";
				else str += "<span>&#x25BC;"+(j)+"</span>";	
				term = null;
			}
			var th = getTH();
			$(this.theader.rows[0]).insert(th);
			th.observe("contextmenu", this.handleRightClick.curry(this));
			str='';
		}
		function getTH(){ 
			var el = new Element('th', {'class':'th_'+self.options.columns[i]});
			el.innerHTML = "<div>"+self.options.headers[self.options.columns[i]]+str+"</div>";
			el.observe('click',function(e){ 
				if(!self.contextMenu.menu.visible()){
					var col;
					if(e.target.tagName=='SPAN') col = e.target.parentNode.parentNode.cellIndex;
					else col = e.target.parentNode.cellIndex;
					self.addSort(e,self.options.columns[col]);
				} else{
					self.contextMenu.hideMenu();
				}
			});
			
			return el;
		}
	},
	
	drawTable: function(){
		//console.time('draw');
		var self = this;
		this.table.className = this.options.className;
		this.drawHeaders();
		this.tbody.innerHTML = '';
		
		//for(var j=0,len=this.tbody.rows.length;j<len;j++)
		//	this.tbody.deleteRow(0);
		
		var rows = 0;    // Counts actual number of rows
		var last = null;
		var subTot = 0;
		var timers = {'mouseOver':0, 'striped':0, 'rowClick':0, 'row':0, 'insertCell':0};
		var t;
		//console.time('mainLoop');
		var bodyArr = [];
		var rowStr = '';
		var propertyStr = '';
		var rowClass = '';

		for(var row=0,len=this.options.data.length; row<len; row++){
			rowClass = '';
			if(!this.options.data[row]._f){ // Check filtered results
				var params = '';
				
				for(var k in this.options.rowConditions){
					var val = this.options.data[row][k],
						val2 = this.options.rowConditions[k].value;
					if(eval("val "+this.options.rowConditions[k].operator+" val2")){
						rowClass += this.options.rowConditions[k].class+' ';							
					} else rowClass = '';
				}

				if(this.options.stripedRows) params += "class='"+rowClass+' '+this.options.stripedRowsClassNames[rows%this.options.stripedRowsClassNames.length]+"' ";
				if(this.options.mouseOverRows) params += "onmouseover=\"this.addClassName('rowOver')\" onmouseout=\"this.removeClassName('rowOver')\"";
				
				rowStr = "<tr row='"+row+"' "+params+">"; // Possibly add stripe class names here?		
				
				
				//t = new Date();
			
				for(j=0, cols=this.options.columns.length; j<cols; j++){
					if(this.options.subTotals && this.options.sortTerms.length){			
						if(this.options.sortTerms[0][0] == this.options.columns[j]){
							if(row==0) last = this.options.data[row][this.options.columns[j]];							
							if(last != this.options.data[row][this.options.columns[j]]){
								bodyArr.push("<tr class='gSubTotal'>");
								for(var k=0; k<cols; k++) 
									if(k==j) bodyArr.push("<td>Sub Total: "+subTot+"</td>");
									else bodyArr.push("<td>&nbsp;</td>");
								bodyArr.push("</tr>");
								last = this.options.data[row][this.options.columns[j]];
								subTot = 1;
							} else subTot++;
						}
					}
					
					//var t2 = new Date();
					
					var cellVal = this.options.data[row][this.options.columns[j]]||"";				
					propertyStr = '';
					if(this.options.conditions[this.options.columns[j]]){
						var cond = this.options.conditions[this.options.columns[j]];
						if(eval("cellVal "+cond.comparison+" cond.value")){
							propertyStr = cond.property.name+'="'+cond.property.value+'"';
						}
					}
					rowStr += "<td "+propertyStr+">"+cellVal+"</td>";
					
					//timers['insertCell'] += (new Date - t2);
				}
				//timers['row'] += (new Date()-t);
				rows++;
				//i++;
				rowStr += "</tr>";
				bodyArr.push(rowStr);
				//t = new Date();
							
				//timers['rowClick'] += (new Date - t);		
				//*/
			}	
		}
		if(this.options.subTotals && this.options.sortTerms.length && subTot != rows && rows>0){
			bodyArr.push("<tr class='gSubTotal'>");
			//console.log('here');
			for(var k=0; k<this.options.columns.length; k++)
				if(k==this.options.columns.indexOf(this.options.sortTerms[0][0]))
					bodyArr.push("<td style='white-space:nowrap'>Sub Total: "+subTot+"</td>");
				else bodyArr.push("<td>&nbsp;</td>");
		}
		var bodyStr = bodyArr.join('');
		this.tbody.innerHTML = bodyStr;
		//console.timeEnd('addHTML');
		if(rows == 0){
			r = this.tbody.insertRow(0);
			c = r.insertCell(0);
			c.colSpan = 100;
			c.innerHTML = 'No Results...';
		}
		//console.log('made it here');
		try{
		if(this.options.onRowClick && this.options.data.length){
			var script = this.options.onRowClick;					
			var regex =  /%(\w+)%/gi;
			var args2 = [];	var args = [];	
			var row = '';

			for(var i=1; i<this.table.rows.length; i++){
				script = this.options.onRowClick;
				args = []; args2 = [];
				row = this.table.rows[i].readAttribute('row');
				while(args = regex.exec(script))
					args2.push(args[1]);					
				args2.each(function(arg){
					//console.log('huh?', self.options.data[i-1]);
					var val = self.options.data[row][arg]?String(self.options.data[row][arg]).replace(/\'/g,'\\\'').replace(/\n/g,'\\n'):'';
					script = script.replace(/%(\w+)%/,val); 
				});

				eval("function tmp(e){"+script+"}");
				$(this.table.rows[i]).observe('click', tmp);
			}
		}	
		} catch(e){  }
		//console.log('here?');
		
		if(this.options.moveableCols) this.setMoveable();
		//console.log(this.table.id,' show footer? ',this.options.footer, rows);
		if(this.options.footer)	this.drawFooter(rows);	
		//console.timeEnd('draw');	
	},
	
	applyRowClick: function(){
		/*
			This function will replace the currently embedded rowClick logic in the draw table section, 
			and will be applied after the table is visible. Should help speed up table re-draw times.
		*/
	},
	
	drawFooter: function(rows){
		if(!this.options.data.length) return;
		if(this.tfooter.rows.length == 1) 
			this.tfooter.deleteRow(0);
		this.tfooter.insertRow(0);
		var c = this.tfooter.rows[0].insertCell(0);	
		c.colSpan = 100;
		if(this.options.showHelp){
			c.innerHTML = "<span style='float:right'>[ </span>";
			var helpLink = new Element("SPAN",{'class':'gHelpLink'});
			helpLink.innerHTML = 'Help';
			var self = this;
			$(c.firstChild).insert(helpLink);										
			helpLink.observe('click',this.showHelpWindow.bindAsEventListener(this));
			$(c.firstChild).insert(' ]');
		}
		$(c).insert('Total: '+rows+' row'+(rows==1?'':'s'));
	},
	
	multisort:function(arr,cols){
		var type = "string";
		if(!this.options.data.length) return;
		var col = cols[0][0];
		var dir = cols[0][1] == 'asc'?true:false;
		var itm = arr[0][col];
		if(this.options.colTypes[col]) type = this.options.colTypes[col];
		else type = "string";
		/* Old code for auto setting type: 
		if(itm){
			if (itm.match(/^\d\d[\/-]\d\d[\/-]\d\d\d\d$/)) type = "date";
			if (itm.match(/^\d\d[\/-]\d\d[\/-]\d\d$/)) type = "date";
			if (itm.match(/^[�$]/)) type = "currency";
			if (itm.match(/^[\d\.]+$/)) type = "number";
		}
		*/
		/*
			Find what's changed in sort order, skip anything previous
			ie: Old sort: [['c0','asc'],['c1','asc']]
			    New Sort: [['c0','asc'],['c1','desc']]
				
			if(cols.length == this.options.sortTerms)	
		*/
		arr.sort(sortFn(col,dir,type));
		if(cols[1]){
			var key = arr[0][col];
			var start=0;
			var i;
			for(i=1; i<arr.length; i++){
				if(arr[i][col]!=key || i == arr.length-1){
					var end = i;
					if(i==arr.length-1 && arr[i][col]==key) end+=1;
					if((end-start)>1){
						var newArr = arr.slice(start,end);
						newArr = this.multisort(newArr,cols.slice(1));
						var cmd = "arr.splice(start,newArr.length,";
						for(var j=0;j<newArr.length;j++) cmd += 'newArr['+j+'],';
						cmd = cmd.substr(0,cmd.length-1);
						eval(cmd+')');
					}
					if(i != arr.length-1){
						key = arr[i][col];	
						start = i;
					}
				}
			}
		}
		function sortFn(C,o,I){
			var x=C,V=o;
			switch(I){case "currency":tCast=l;break;case "number":tCast=c;break;case "string":tCast=i;break;case "date":tCast=v;break;default:O}
		return function(l,o){var i=tCast(l[x]),I=tCast(o[x]);if(i<I)return V?-1:1;if(i>I)return V?1:-1;return 0}
		function l(i){return parseFloat(i.replace(/[^0-9\-.]/g,''))}
		function c(i){if(isNaN(i))return 0;return parseFloat(i)}
		function i(I){return I?String(I).toLowerCase():''}
		function O(i){return i}
		function v(i){return Date.parse(i)}}
	
		return arr;
	},
	
	setMoveable: function(){
		var self = this;
		// find way to change this line so as to not require an ID?
		var dheaders = $$('#'+this.table.id+' th div');
		dheaders.each(function(a){
			var t;
			a.onmousedown = function(event){
				var e = event?event:window.event;
				var startx = e.clientX;
				var starty = e.clientY;	
				t = setTimeout(function(){
						a.onmouseup=null;
						self.moveHeaderPrep(e,a,startx,starty);
					} , self.options.moveableWait)
			}
			a.onmouseup = function(){ clearTimeout(t) };
		});
	},
	
	moveHeaderPrep: function(e,obj,startx, starty){
		//var e = e?e:window.event;                                             -- Shouldn't need this
		var self = this;
		var objIndex = obj.parentNode.cellIndex;
		
		obj.className = 'moveable';
		obj.style.height = obj.parentNode.offsetHeight;

		self.tbody.rows[0].cells[objIndex].style.width = obj.offsetWidth+'px';
		clearSelection();
		
		var objPos = Position.positionedOffset(obj);
	
		obj.style.width = obj.parentNode.offsetWidth+'px';
		
		var offsetX = startx - objPos[0]; // e.clientX -> startx
		var offsetY = starty - objPos[1]; 
		obj.style.position = 'absolute';
		obj.style.left = objPos[0]+'px';
		obj.style.top = objPos[1]+'px'; 
		
		var pos = Position.cumulativeOffset(self.theader);
		var minx = pos[0];
		var maxx = (pos[0]+parseInt(self.theader.offsetWidth));
		
		var bounds = [];
		$A(self.theader.rows[0].cells).each(function(h){ bounds[h.cellIndex] = Position.cumulativeOffset(h)[0]+h.offsetWidth });
		var space = bounds[1]-(bounds[0]+this.theader.rows[0].cells[1].offsetWidth);

		var boundsL = bounds.length;
		var insertAt = obj.parentNode.cellIndex;
		var z;
		var pointer = document.createElement('div');
		pointer.style.cssText = "position:absolute; height:12px; width:12px; font-size:12px";
		pointer.style.top = (pos[1]-14)+'px';
		pointer.style.left = '-10px'; // Start pointer out of screen
		pointer.innerHTML = '&#x25BC;';
		document.body.appendChild(pointer);
		
		function moveHeader(e){
			var e = e||window.event;
			if( e.clientX > minx && e.clientX<maxx)	obj.style.left = (e.clientX - offsetX) + 'px';
		 	else return;
			for(z=0; z<boundsL; z++)
				if(e.clientX < bounds[z]) break;	
			if(insertAt != z && z < bounds.length){
				var c = self.table.rows[0].cells[z];
				var cO = Position.cumulativeOffset(c);
				//console.log(cO[0]+' '+(cO[0]+c.offsetWidth));
				if(objIndex >= z){
					pointer.style.left = (cO[0]-4)+'px';
				} else {
					pointer.style.left = (cO[0]-4+c.offsetWidth)+'px';
				}
				insertAt = z;
			}
		}
		
		function moveHeaderStop(event){
			var e = event||window.event;
			var curx = e.clientX;
			//var y = Position.cumulativeOffset(parent)[1] + parent.offsetHeight/2; // Gets Middle of header Bar position for figuring out which th you are over when mouseup
			$(document.body).removeChild(pointer);
			obj.style.cssText = '';
			obj.className = '';

			var tmp = self.options.columns;
			tmp.splice(insertAt,0,tmp.splice(objIndex,1)[0]);
			self.options.columns = tmp;
			
			self.drawTable();
			if(self.cookies) self.saveCookies();
			$(document.body).stopObserving('mousemove', moveHeader);
			$(document.body).stopObserving('mouseup', moveHeaderStop);
			clearSelection();
			
		}
		$(document.body).observe('mousemove', moveHeader );
		$(document.body).observe('mouseup', moveHeaderStop);
		
		function clearSelection(){
			if (document.selection)	document.selection.empty();
			else if (window.getSelection) window.getSelection().removeAllRanges();
		}
	},
	
	saveCookies: function(){		
		var cookie = {columns:this.options.columns, sortTerms:this.options.sortTerms, filters:this.options.filters, subTotals: this.options.subTotals};
		cookie = Object.toJSON(cookie);
		Cookie.create('gTableSaved_'+this.table.id, cookie, 30);
	},
	
	loadCookies: function(){
		var cookie = Cookie.read('gTableSaved_'+this.table.id);
		if(cookie){
			var settings = cookie.evalJSON(true);		
			for(var k in settings){
				this.options[k] = settings[k];				
			}
			if(settings['sortTerms'].length) this.multisort(this.options.data,this.options.sortTerms);
			if(settings['filters']) this.filterData();
			this.contextMenu.showSubTotalsCheck.checked = settings['subTotals'];			
			
		}
	},
	
	showHelpWindow: function(e){
		if(!this.helpWindow){
			this.helpWindow = new Element('div', {'class':"gHelpWindow"} );
			this.helpWindow.innerHTML = "<DL><DT>Context Menu</DT><DD>This Table features a context menu which keeps advanced functions in a convenient location. To access the context menu, simply right-click anywhere on the table header. Certain menu options, such as 'Add Sort', 'Remove Sort', and 'Add Filter' apply only to the header which was clicked on, whereas the other options affect the table as a whole.</DD><DT>Sorting Columns</DT><DD>To set a column as the primary sort column, left-click on the column header. To add additional sort columns, right-click on a different header and then click 'Add Sort' in the pop-up menu. Clicking on the &#x25B2; or &#x25BC; arrows toggles the sort order of the given column, whereas clicking anywhere else in the header sets that column as the primary sort column. </DD><DT>Show SubTotals</DT><DD>This checkbox toggles whether or not to show subTotals for the primary sort column.</DD><DT>Add Filter</DT><DD>When you add a Filter to a column, only the results from that column which match the Filter value will be displayed.</DD><DT>Remove Filter(s)</DT><DD>Click directly on 'Remove Filter(s)' to remove all active Filters, or select just one to remove from the pop-up list.</DD><DT>Column Chooser</DT><DD>Let's you choose which columns to display in the table.</DD><DT>Re-order columns</DT><DD>To Re-order columns, simply click and hold on the header of the column until the header changes color, then drag it to the left or right until the arrow indicates the new desired position.</DD><DL>";
			this.helpWindow.hide();
			$(document.body).insert(this.helpWindow,{position:'bottom'});
			this.helpWindow.observe('click',function(e){e.stop()});
		}
		var vp = document.viewport.getDimensions();
		var offset = document.viewport.getScrollOffsets();
		var size = this.helpWindow.getDimensions();
		if(vp.height < size.height) vp.height = size.height+100;
		if(vp.width < size.width) vp.width = size.width+100;
		var top = (vp.height/2 - size.height/2) + offset.top;
		var left = (vp.width/2 - size.width/2) + offset.left;
		this.helpWindow.style.top = top+'px';
		this.helpWindow.style.left = left+'px';
		this.helpWindow.show();
		e.stop();
	}
});

var gTable_Menu = Class.create({
	_column : null,
	
	initialize:function(parent){
		var self = this;

		this.gTable = parent;
		this.menu = new Element("ul",{'id':'gTable_contextMenu', 'class':'cmenu', 'style':'display:none'});
		this.links = {};
		this.subs = {};
					
		this.links.columnChooser = new Element("li",{'class':'parent'});
		this.links.columnChooser.innerHTML = "<b>Column Chooser</b>";
		
		this.subs.columnChooser = new Element("ul",{'class':'cmenu'});
		
		$(this.links.columnChooser).insert(this.subs.columnChooser);
		
		this.links.addFilter = new Element("li",{'class':'parent'});
		this.links.addFilter.innerHTML = "<b>Add Filter</b>";
		
		this.subs.addFilter = new Element("ul",{'class':'cmenu'});
		this.links.addFilter.insert(this.subs['addFilter']);
		
		this.addFilterInput = new Element("input",{'type':'text','class':'text'});
		this.subs.addFilter.innerHTML = "<li><b></b></li>";
		$(this.subs.addFilter.firstChild.firstChild).insert(this.addFilterInput);
	
		this.addFilterInput.observe('keypress',function(e){ var key = e.keyCode||e.charCode; if(key==Event.KEY_RETURN){ self.addFilter(e);  } });
		
		this.links.removeFilter = new Element("li");
		this.links.removeFilter.innerHTML = "<b>Remove Filter(s)</b>";
		this.subs.removeFilter = new Element("ul",{'class':'cmenu'});
		this.links.removeFilter.insert(this.subs.removeFilter);
		
		this.links.addSort = new Element("li");
		this.links.addSort.innerHTML = "<b>Add Sort</b>";

		this.links.removeSort = new Element("li");
		this.links.removeSort.innerHTML = "<b>Remove Sort</b>";
		
		this.links.clearSort = new Element("li");
		this.links.clearSort.innerHTML = "<b>Clear Sort(s)</b>";
		
		this.links.showSubTotals = new Element("li");
		this.links.showSubTotals.innerHTML = "<b>Show SubTotals</b>";
		this.showSubTotalsCheck = new Element("input",{'type':'checkbox'});
		this.showSubTotalsCheck.observe('click',this.showSubTotals.bindAsEventListener(this));
		$(this.links.showSubTotals.firstChild).insert(this.showSubTotalsCheck, {position:'top'});
	
		for(itm in this.links){
			this.links[itm].observe('menu:disable',(this.mDisable).bindAsEventListener(this.links[itm]));
			this.links[itm].observe('menu:enable',(this.mEnable).bindAsEventListener(this.links[itm]));
			this.links[itm].observe('click',this[itm].bindAsEventListener(this));
		}
		
		this.menu.insert(this.links['addSort']); // sortAscending, sortDescending
		this.menu.insert(this.links['removeSort']);
		this.menu.insert(this.links['clearSort']);
		this.menu.insert("<li class='divider'></li>");
		this.menu.insert(this.links['showSubTotals']);
		this.menu.insert("<li class='divider'></li>");
		this.menu.insert(this.links['addFilter']);	
		this.menu.insert(this.links['removeFilter']);
		this.menu.insert("<li class='divider'></li>");
		this.menu.insert(this.links['columnChooser']);
		
			
		$(document.body).insert(this.menu);
		
		this.showSubTotalsCheck.checked = this.gTable.options.subTotals;
		
		$$('ul.cmenu li').each(function(li){
			if(li.className == 'divider') return;
			li.observe('mouseover',function(e){ this.addClassName('over'); });
			li.observe('mouseout', function(e){ this.removeClassName('over'); });
		});
		
	},
	
	showMenu:function(e){
		if(e.target.tagName != 'DIV')
			var index = e.target.parentNode.parentNode.cellIndex;
		else 

			var index = e.target.parentNode.cellIndex;
		
		this._column = this.gTable.options.columns[index];
		this._x = e.pointerX();
		this._y = e.pointerY();		
		this.menu.style.top = this._y+'px';
		this.menu.style.left = this._x+'px';

		this.setupColumnChooser();
		this.setupRemoveFilter();
		
		if(!this.gTable.options.sortTerms.find(function(s){
			if(s[0]==this._column) return true; 
		}.bind(this))){
			$(this.links.removeSort).fire('menu:disable');
		} else {
			$(this.links.removeSort).fire('menu:enable');
		}
	
		if(this.gTable.options.sortTerms.length==0) $(this.links.clearSort).fire('menu:disable');
		this.menu.style.display = 'block';	
	},
	
	setupColumnChooser:function(){
		//console.log('setupColumnChooser');
		var self = this;
		this.subs.columnChooser.innerHTML = '';
		for(var i=0; i<this.gTable.options.order.length; i++){
			var li = getLI(this.gTable.options.order[i]);
			this.subs.columnChooser.appendChild(li);
			//console.log(this.gTable.options.columns, this.gTable.options.columns.indexOf(key));
			if(this.gTable.options.columns.indexOf(this.gTable.options.order[i])!=-1)
				li.firstChild.firstChild.checked = true;
		}
		function getLI(key){
			var li = new Element('li');
			li.observe('mouseover',function(){this.addClassName('over');});
			li.observe('mouseout',function(){this.removeClassName('over');});
			li.innerHTML = "<b> "+self.gTable.options.headers[key]+"</b>";
			var input = new Element('input',{'type':'checkbox','value':key});
			input.observe('click',function(e){
				var val = this.value;
				if(this.checked){ self.gTable.options.columns.push(this.value); }
				else{
					self.gTable.options.sortTerms = self.gTable.options.sortTerms.reject(function(s){ return s[0]==val; });
					self.gTable.options.columns = self.gTable.options.columns.without(this.value);
				}
				self.gTable.drawTable();
			});
			$(li.firstChild).insert({top:input});
			return li;
		}
	},
	
	setupRemoveFilter:function(){
		//console.log('setupRemoveFilter');
		var self = this;
		this.subs.removeFilter.innerHTML = '';
		
		if(typeof(this.gTable.options.filters[this._column])=='undefined'){
			this.gTable.options.filters[this._column] = [];		
		}
		var found = false;
		for(var k in this.gTable.options.filters){
			this.gTable.options.filters[k].each(function(g){
				found = true;
				var li = new Element('li');
				li.innerHTML = "<b title='"+g.orig+"'>"+self.gTable.options.headers[k]+':'+g.orig+"</b>";
				li.observe('click',function(e){
					if(e.target.tagName=='LI')
						var val = e.target.firstChild.title;
					else
						var val = e.target.title;
					self.gTable.removeFilter(self._column, val);	
					self.menu.hide();
				});
				li.observe('mouseover',function(){this.addClassName('over');});
				li.observe('mouseout',function(){this.removeClassName('over');});
				self.subs.removeFilter.insert(li);
			});
		}
		if(found){
			this.links.removeFilter.addClassName('parent');
			this.links.removeFilter.fire('menu:enable');
		} else {
			this.links.removeFilter.removeClassName('parent');
			this.links.removeFilter.fire('menu:disable');
		}
	},
	
	
	hideMenu:function(e){
		this.menu.hide();
	},
	
	columnChooser:function(e){
		if(e.target.tagName == 'INPUT') return;
		if(!e.target.hasClassName('parent')){
			if(e.target.tagName == 'LI')
				var chk = $(e.target.firstChild.firstChild);
			else
				var chk = $(e.target.firstChild);
			chk.click();
		}		
	},
	
	addFilter:function(e){
		e.stop();
		var key = e.keyCode||e.charCode;
		if(key == 13){
			this.menu.hide();
			this.links.removeFilter.fire('menu:enable');
			this.gTable.addFilter();			
		} else {
			this.addFilterInput.focus();		
		}
		
		return;	
	},
	
	removeFilter:function(e){
		this.gTable.options.filters = {};
		this.hideMenu();
		this.gTable.filterData();
		this.gTable.drawTable();
	},
	
	addSort:function(e){
		this.gTable.addSort(e,this._column);
		this.links.removeSort.fire('menu:enable');
		this.hideMenu();
	},
	
	removeSort:function(e){
		this.gTable.removeSort(this._column);
		this.links.removeSort.fire('menu:disable');
	},
	
	clearSort:function(e){
		this.gTable.clearSort();
	},
	
	showSubTotals:function(e){
		if(e.target.tagName != 'INPUT')
			this.showSubTotalsCheck.checked = this.showSubTotalsCheck.checked?false:true;
		this.gTable.options.subTotals = this.showSubTotalsCheck.checked	
		if(this.gTable.options.sortTerms.length)
			this.gTable.drawTable();
	},
	
	mDisable:function(event){
		$(this).addClassName('disabled');		
		$(this.firstChild).observe('click', function(event){ event.stop(); } );
	},
	
	mEnable:function(event){
		$(this).removeClassName('disabled');
		$(this.firstChild).stopObserving();
	}
});

var Cookie = {
	create: function(name,value,days) {
		if(days){
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		} else var expires = "";
		document.cookie = name+"="+value+expires+"; path=/";
	},
	read: function(name){
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i=0;i < ca.length;i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;
	},
	erase: function(name) {
		Cookie.create(name,"",-1);
	}	
};