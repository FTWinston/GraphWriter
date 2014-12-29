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
	$('#btnMode').click(function () { toggleMode(); return false; });
	$('#btnLookups').click(function () { $('#manageLookups').dialog('open'); return false; });
	$('#nodeView').on('click', '.link', function(event) { openLookup($(event.currentTarget).text()) });
	document.getElementById('fileInput').addEventListener('change', load, false);
	
	$('#lookupPopup').dialog({
      autoOpen: false,
      height: 500,
      width: 500,
      modal: true,
	});
	$('#manageLookups').dialog({
      autoOpen: false,
      height: 500,
      width: 650,
      modal: true,
	  title: 'Manage lookups',
      buttons: {
        Add: function() { /* prompt, add to list */ },
		Remove: function() { /* remove selected */ }
	  },
	  beforeClose: function() { saveSelectedLookup();}
	});
	
	$('#lookupList').on('click', 'li', function() {
		saveSelectedLookup();
		var name = $(this).addClass('selected').text();
		$('#lookupEdit')
			.val(allLookups[name])
			.focus();
	});
});

var editMode = true;
var nextElementID = 1;
var allNodes = {};
var allLookups = {};

function Link(from, to, style) {
    this.fromNode = from;
    this.toNode = to;
	this.style = style;
	this.elementID = 'line' + (nextElementID++);
	this.text = null;
}

function Node(name, text, x, y) {
	this.name = name;
	if (x === undefined)
		x = Math.floor((Math.random() * 480) + 10);
	if (y === undefined)
		y = Math.floor((Math.random() * 480) + 10);
	this.x = x; this.y = y;
	this.editText = text;
	this.viewText = calculateView(text);
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
	editor.val(currentNode.editText);
	editor.focus();
	
	var viewer = $('#nodeView');
	viewer.html(currentNode.viewText);
}

function checkInput() {
	var editor = $('#nodeEdit');
	var rawInput = editor.val().trim();
	
	if (rawInput == '')
		return;
	
	if (currentNode != null && rawInput == currentNode.editText)
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
		currentNode.editText = rawInput;
		currentNode.viewText = calculateView(rawInput);
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
			var lineContent = line.substr(1).trim();
			if (lineContent == '')
				continue;
			
			var destinationName = lineContent;
			var linkText = null;
			var separator = lineContent.indexOf('#')
			if (separator != -1)
			{
				destinationName = lineContent.substr(0, separator).trim();
				linkText = lineContent.substr(separator + 1).trim();
				if (destinationName == '')
					continue;
				if (linkText == '')
					linkText = null;
			}
			
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
			link.text = linkText;
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
	
	var leftward = link.fromNode.x > link.toNode.x;
	var leftNode = leftward ? link.toNode : link.fromNode;
	var rightNode = leftward ? link.fromNode : link.toNode;
	
	// set x & y of each end
	line.attr('d', 'M' + leftNode.x + ' ' + leftNode.y + ' L' + rightNode.x + ' ' + rightNode.y + ' Z');
}

function updateLinkText(link) {
	var textElem = $('#' + link.elementID + '_text');
	
	if (link.text == null) 	{
		textElem.remove();
		return;
	}
	
	var textPath;
	if (textElem.length == 0) {
		textElem = $(SVG('text'))
			.attr('class', 'link')
			.attr('id', link.elementID + '_text')
			.attr('text-anchor', 'middle')
			.prependTo($('#graph'));
		
		textPath = $(SVG('textPath'))
			.appendTo(textElem);
		textPath[0].setAttribute('startOffset', '25%');
		textPath[0].setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + link.elementID);
	}
	else
		textPath = textElem.children();
	
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
	var lookups = $('<lookups/>');
	lookups.appendTo(root);
	for (var name in allLookups)
		$('<lookup/>')
			.attr('name', name)
			.text(allLookups[name])
			.appendTo(lookups);
	
	for (var name in allNodes) {
		var node = allNodes[name];
		
		$('<node/>')
			.attr('x', node.x)
			.attr('y', node.y)
			.text(node.editText)
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
	allLookups = {};
	nextElementID = 1;
	$('#nodeEdit').val('');
	$('#graph').html('');
	currentNode = null;
	
	var first = true;
	doc.children().each(function () {
		var element = $(this);
		
		if (first) {
			first = false;
			if (element.get(0).nodeName.toLowerCase() == 'lookups') {
				element.children().each(function () {
					var child = $(this);
					addNewLookup(child.attr('name'), child.text());
				});
				return;
			}
		}
		
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
		var lines = node.editText.split(/\r?\n/);
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

function toggleMode() {
	editMode = !editMode;
	$('#spnMode').text(editMode ? 'in edit mode' : 'in view mode');
	$('#btnMode').text(editMode ? 'switch to view mode' : 'switch to edit mode');
	
	$(editMode ? '#nodeEdit' : '#nodeView').show();
	$(editMode ? '#nodeView' : '#nodeEdit').hide();
}

function calculateView(rawInput) {
	var output = '';
	
	var lines = rawInput.split(/\r?\n/);
	output += '<h3>' + lines[0].trim() + '</h3>';
	var reachedContent = false;
	for (var i=1; i<lines.length; i++) {
		var line = lines[i];
		if (line.length > 1 && line.substr(0, 1) == '#')
			continue;
		
		if (reachedContent)
			output += '<br/>';
		else if (line.trim().length > 0)
			reachedContent = true;

		output += line;
	}
	
	output = markup(output, '*', 'div', 'description');
	output = markup(output, '@', 'span', 'link', addNewLookup);
	return output;
}

function markup(text, marker, tag, cssClass, forEach) {
	var sectionStart = -1;
	var inSection = false;
	
	while (true) {
		var pos = text.indexOf(marker, pos);
		if (pos == -1)
			break;
		
		if (inSection) {
			text = text.replace(marker, '</' + tag + '>');
			
			if (forEach !== undefined) {
				var entry = text.substr(sectionStart, pos - sectionStart);
				forEach(entry);
			}
		}
		else {
			text= text.replace(marker, '<' + tag + ' class="' + cssClass + '">');
			pos += tag.length + cssClass.length + 11;
			sectionStart = pos;
		}
		inSection = !inSection;
	}

	if (inSection) {
		if (forEach !== undefined) {
			var entry = text.susbstr(sectionStart);
			forEach(entry);
		}
		
		text += '</' + tag + '>'
	}
	
	// remove <br/> tags immediately before or after divs
	return text.replace(/<\/div><br\/><br\/>/, '</div><br/>').replace(/<br\/><br\/><div/, '<br/><div');
}

function openLookup(name) {
	if (!allLookups.hasOwnProperty(name))
		return;
	
	$('#lookupPopup')
		.text(allLookups[name])
		.dialog('option', 'title', name)
		.dialog('open');
}

function addNewLookup(name, value) {
	if (allLookups.hasOwnProperty(name))
		return;

	allLookups[name] = value === undefined ? '' : value;
	$('#lookupList').append('<li>' + name + '</li>');
}

function saveSelectedLookup() {
	var existing = $('#lookupList li.selected');
	if (existing.length == 0)
		return;

	existing.removeClass('selected');
	var name = existing.text();
	allLookups[name] = $('#lookupEdit').val();
}