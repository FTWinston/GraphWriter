$(function () {
	$('#nodeEdit').blur(checkInput);
	
	$('#graph').click(function () {
		checkInput();
		remClass($('#graph g.node.selected'), 'selected');
		currentNode = '';
		$('#nodeEdit').val('');
	});
});

var nextElementID = 1;
var allNodes = {};

function Link(from, to, style) {
    this.fromNode = from;
    this.toNode = to;
	this.style = style;
	this.elementID = 'line' + (nextElementID++);
}

function Node(name, text) {
	this.name = name;
	this.x = Math.floor((Math.random() * 480) + 10); this.y = Math.floor((Math.random() * 480) + 10);
	this.text = text;
	this.elementID = 'node' + (nextElementID++);
	
	this.outgoingLinks = [];
	this.incomingLinks = [];
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
		}
		currentNode.text = rawInput;
	}

	allNodes[currentNode.name] = currentNode;
	
	var previousLinks = currentNode.outgoingLinks;
	currentNode.outgoingLinks = [];
	for (var i=1; i<lines.length; i++) {
		var line = lines[i];
		if (line.length > 1 && line.substr(0, 1) == '#') {
			var destinationName = line.substr(1).trim();
			
			var destinationNode;
			if (allNodes.hasOwnProperty[destinationName])
				destinationNode = allNodes[destinationName];
			else {
				destinationNode = new Node(destinationName, destinationName + '\r\n\r\n');
				allNodes[destinationNode.name] = destinationNode;
				updateNodeImage(destinationNode);
			}
			
			var link = $.grep(previousLinks, function(l) { return l.toNode == destinationNode; });
			if (link.length == 0) {
				link = new Link(currentNode, destinationNode, LinkStyle.Plain);
				destinationNode.incomingLinks.push(link);
			}
			else {
				link = link[0];
				arrayRemoveItem(previousLinks, link);
			}
			
			currentNode.outgoingLinks.push(link);
		}
	}
	
	updateNodeImage(currentNode);
	
	for (var i=0; i<currentNode.outgoingLinks.length; i++) {
		var link = currentNode.outgoingLinks[i];
		updateLine(link);
	}
	for (var i=0; i<previousLinks.length; i++) {
		var link = previousLinks[i];
		removeLine(link);
	}
	
	editor.val('');
	currentNode = null;
	remClass($('#graph g.node.selected'), 'selected');
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
		
		group.click(function(e) {
			e.stopPropagation();
			nodeSelected(this);
		});
	}
	
	var textNode = group.children('text')
	textNode.text(node.name);
	
	var bbox = textNode.get(0).getBBox();
	
	textNode.attr('transform', 'translate(-' + (bbox.width / 2) + ' -2.5)');
	
	group.children('rect') // recalculate size of rectangle?
		.attr('width', bbox.width + 1)
		.attr('height', bbox.height + 1)
		.attr('transform', 'translate(-' + (bbox.width / 2 + 0.5) + ' -' + (bbox.height + 0.5) + ')');
}

function updateLine(link) {
	var line = $('#' + link.elementID);
	if (line.length == 0) {
		line = $(SVG('line'))
			.attr('class', 'link plain')
			.attr('id', link.elementID)
			.prependTo($('#graph'));
	}
	
	// set x & y of each end
	line.attr('x1', link.fromNode.x)
		.attr('x2', link.toNode.x)
		.attr('y1', link.fromNode.y)
		.attr('y2', link.toNode.y);
}

function deleteNodeImage(node) {
	$('#' + node.elementID).remove();
}

function deleteLine(link) {
	$('#' + link.elementID).remove();
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