$(function () {
	$('#nodeEdit').blur(checkInput);
	
	$('#graph').click(function () {
		checkInput();
		remClass($('#graph g.node.selected'), 'selected');
		currentNode = null;
		$('#nodeEdit').val('');
	});
	
	$('#btnSave').click(save);
	$('#btnLoad').click(function () { $('#fileInput').trigger('click'); return false; });
	$('#btnDelete').click(function () { if (currentNode !== null && confirm("Delete selected node?")) deleteCurrentNode(); return false; });
	document.getElementById('fileInput').addEventListener('change', load, false);
});

var nextElementID = 1;
var allNodes = {};

function Link(from, to, style) {
    this.fromNode = from;
    this.toNode = to;
	this.style = style;
	this.elementID = 'line' + (nextElementID++);
	this.text = 'link text blah';
}

function Node(name, text, x, y) {
	this.name = name;
	if (x === undefined)
		x = Math.floor((Math.random() * 480) + 10);
	if (y === undefined)
		y = Math.floor((Math.random() * 480) + 10);
	this.x = x; this.y = y;
	this.text = text;
	this.elementID = 'node' + (nextElementID++);
	
	this.outgoingLinks = [];
	this.incomingLinks = [];
	
	allNodes[name] = this;
	updateNodeImage(this);
}

var LinkStyle = {
    Plain: 0,
    Dashed: 1
};

var currentNode = null;

function nodeSelected(element) {
	var clickedNode = null;
	var elementID = element.getAttribute('id');
	
	// find selected node
	for (var name in allNodes) {
		var node = allNodes[name];
		if (node.elementID == elementID) {
			clickedNode = node;
			break;
		}
	}
	
	if (clickedNode == null || clickedNode == currentNode)
		return;
	
	checkInput();
	currentNode = clickedNode;
	
	remClass($('#graph g.node.selected'), 'selected');
	addClass(element, 'selected');
	
	// remove element from DOM and re-add it, because SVG z-index is based on element order
	var parent = element.parentNode;
	parent.removeChild(element);
	parent.appendChild(element);
	
	var editor = $('#nodeEdit');
	editor.val(currentNode.text);
	editor.focus();
}

function checkInput() {
	var editor = $('#nodeEdit');
	var rawInput = editor.val().trim();
	
	if (rawInput == '')
		return;
	
	if (currentNode != null && rawInput == currentNode.text)
		return; // no change

	var lines = rawInput.split(/\r?\n/);
	
	var name = lines[0].trim();
	if (name == '') {
		alert('Please enter a node name on the first line.');
		editor.focus();
		return;
	}
	if (currentNode == null && allNodes.hasOwnProperty(name)) {
		alert('Warning, you already have a node with this name. Please change it.');
		editor.focus();
		return;
	}
	
	if (currentNode == null)
		currentNode = new Node(name, rawInput);
	else {
		if (currentNode.name != name) {
			delete allNodes[currentNode.name];
			currentNode.name = name;
			allNodes[currentNode.name] = currentNode;
			updateNodeImage(currentNode);
		}
		currentNode.text = rawInput;
	}
	
	updateLinks(currentNode, lines);
	
	editor.val('');
	currentNode = null;
	remClass($('#graph g.node.selected'), 'selected');
}

function updateLinks(node, lines) {
	var previousLinks = node.outgoingLinks;
	node.outgoingLinks = [];
	
	for (var i=1; i<lines.length; i++) {
		var line = lines[i];
		if (line.length > 1 && line.substr(0, 1) == '#') {
			var destinationName = line.substr(1).trim();
			if (destinationName == '')
				continue;
			
			var destinationNode;
			if (allNodes.hasOwnProperty(destinationName))
				destinationNode = allNodes[destinationName];
			else
				destinationNode = new Node(destinationName, destinationName + '\r\n\r\n');
			
			var link = $.grep(previousLinks, function(l) { return l.toNode == destinationNode; });
			if (link.length == 0) {
				link = new Link(node, destinationNode, LinkStyle.Plain);
				destinationNode.incomingLinks.push(link);
			}
			else {
				link = link[0];
				arrayRemoveItem(previousLinks, link);
			}
			
			node.outgoingLinks.push(link);
		}
	}
	
	for (var i=0; i<node.outgoingLinks.length; i++) {
		var link = node.outgoingLinks[i];
		updateLine(link);
		updateLinkText(link);
	}
	for (var i=0; i<previousLinks.length; i++) {
		var link = previousLinks[i];
		deleteLine(link);
		arrayRemoveItem(link.toNode.incomingLinks, link);
	}
}

function updateNodeImage(node) {
	var group = $('#' + node.elementID);
	if (group.length == 0) {
		var group = $(SVG('g'))
			.attr('class', 'node')
			.attr('id', node.elementID)
			.attr('transform', 'translate(' + node.x + ' ' + node.y + ')') // set x & y
			.appendTo($('#graph'));
		
		var rect = $(SVG('rect'))
			.appendTo(group);
		
		$(SVG('text')).appendTo(group);
		group.mousedown(dragStart)
			.click(function (e) { e.stopPropagation(); });
	}
	
	var textNode = group.children('text')
	textNode.text(node.name);
	
	var bbox = textNode.get(0).getBBox();
	
	textNode.attr('transform', 'translate(-' + (bbox.width / 2) + ' ' + (bbox.height / 3) + ')');
	
	group.children('rect') // recalculate size of rectangle?
		.attr('width', bbox.width + 10)
		.attr('height', bbox.height + 2)
		.attr('transform', 'translate(-' + (bbox.width / 2 + 5) + ' -' + (bbox.height / 2) + ')');
}

function updateLine(link) {
	var line = $('#' + link.elementID);
	if (line.length == 0) {
		line = $(SVG('path'))
			.attr('class', 'link plain')
			.attr('id', link.elementID)
			.prependTo($('#graph'));
	}
	
	// set x & y of each end
	line.attr('d', 'M' + link.fromNode.x + ' ' + link.fromNode.y + ' L' + link.toNode.x + ' ' + link.toNode.y + ' Z');
}

function updateLinkText(link) {
	var text = $('#' + link.elementID + '_text');
	var textPath;
	if (text.length == 0) {
		text = $(SVG('text'))
			.attr('class', 'link')
			.attr('id', link.elementID + '_text')
			.prependTo($('#graph'));
		
		textPath = $(SVG('textPath'))
			.attr('startOffset', '20%')
			.appendTo(text);
		textPath[0].setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + link.elementID);
	}
	else
		textPath = text.children();
	
	textPath.text(link.text);
}

function deleteNodeImage(node) {
	$('#' + node.elementID).remove();
}

function deleteLine(link) {
	$('#' + link.elementID).remove();
	$('#' + link.elementID + '_text').remove();
}

function SVG(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function addClass(elem, className) {
    var classNameSpaced = ' ' + className + ' ';
    var classes = elem.getAttribute('class');
    var spaced = ' ' + classes + ' ';
    if (spaced.indexOf(classNameSpaced) != -1)
        return;
    elem.setAttribute('class', classes + ' ' + className);
}

function remClass(elems, className) {
    var spaced = ' ' + className + ' ';
    elems.each(function () {
        var classes = ' ' + this.getAttribute('class') + ' ';
        if (classes.indexOf(spaced) == -1)
            return;
        this.setAttribute('class', classes.replace(spaced, ' ').trim());
    });
}

function arrayIndexOf(array, item) {
    if (typeof Array.prototype.indexOf == "function")
        return Array.prototype.indexOf.call(array, item);
    for (var i = 0, j = array.length; i < j; i++)
        if (array[i] === item)
            return i;
    return -1;
}

function arrayRemoveItem(array, itemToRemove) {
    var index = arrayIndexOf(array, itemToRemove);
    if (index >= 0) {
        array.splice(index, 1);
        return true;
    }
    return false;
};


var dx = 0;
var dy = 0;
function dragStart(e) {
	nodeSelected(this);
	
	dx = e.offsetX - currentNode.x;
	dy = e.offsetY - currentNode.y;
	
	$('#graph')
		.on('mousemove', dragMove)
		.on('mouseout', dragStop)
		.on('mouseup', dragStop);
}

function dragMove(e) {
	if(currentNode == null)
		return;
	
	var x = e.offsetX - dx;
	var y = e.offsetY - dy;

	currentNode.x = x; currentNode.y = y;
	$('#' + currentNode.elementID).attr('transform', 'translate(' + x + ' ' + y + ')');
	
	for (var i=0; i<currentNode.incomingLinks.length; i++)
		updateLine(currentNode.incomingLinks[i]);
	for (var i=0; i<currentNode.outgoingLinks.length; i++)
		updateLine(currentNode.outgoingLinks[i]);
}

function dragStop(evt) {
	$('#graph')
		.off('mousemove', dragMove)
		.off('mouseout', dragStop)
		.off('mouseup', dragStop);
}

function save() {
	var root = $('<graph/>');
	for (var name in allNodes) {
		var node = allNodes[name];
		
		$('<node/>')
			.attr('x', node.x)
			.attr('y', node.y)
			.text(node.text)
			.appendTo(root);
	}
	
	var content = $('<div/>').append(root).html();
	window.location.href = 'data:application/octet-stream,' + encodeURIComponent(content);
	return false;
}

function load(evt) {
    var f = evt.target.files[0]; 

    if (f) {
      var r = new FileReader();
      r.onload = function(e) { 
	      loadData($(e.target.result)); 
      }
      r.readAsText(f);
    }
	else 
      alert("Failed to load file");
}

function loadData(doc) {
	allNodes = {};
	nextElementID = 1;
	$('#nodeEdit').val('');
	$('#graph').html('');
	currentNode = null;
	
	doc.children().each(function () {
		var element = $(this);
		var x = element.attr('x');
		var y = element.attr('y');
		var text = element.text();
	
		var lines = text.split(/\r?\n/);
		var name = lines[0].trim();
		var node = new Node(name, text, x, y);
		allNodes[name] = node;
	});
	
	for (var name in allNodes) {
		var node = allNodes[name];
		var lines = node.text.split(/\r?\n/);
		updateLinks(node, lines);
	}
}

function deleteCurrentNode() {
	// delete all incoming and outgoing links to this node
	for (var i=0; i<currentNode.outgoingLinks.length; i++) {
		var link = currentNode.outgoingLinks[i];
		deleteLine(link);
		arrayRemoveItem(link.toNode.incomingLinks, link);
	}
	for (var i=0; i<currentNode.incomingLinks.length; i++) {
		var link = currentNode.incomingLinks[i];
		deleteLine(link);
		arrayRemoveItem(link.fromNode.outgoingLinks, link);
	}
	
	delete allNodes[currentNode.name];
	deleteNodeImage(currentNode);
	
	currentNode = null;
	$('#nodeEdit').val('');
}