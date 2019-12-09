class Response {
	constructor(response) {
		this.response = response;
		this.methods = ["json", "text", "blob"];
	}
	parseHeaders() {
		for (var h of this.response.headers.entries()) {
			this.headers[h[0]] = h[1];
			if (h[0] == "content-type") {
				this.contentType = h[1];
			}
		}
	}
	resolve() {
		return this.parseData(0);
	}
	parseData(i) {
		let response = this.response.clone();
		return response[this.methods[i]]()
			.then(data => {
				this.data = data;
				return this;
			})
			.catch(err => {
				if (!response.ok) {
					return response;
				}
				else {
					if (i == this.methods.length) {
						return this;
					}
					return this.parseData(i + 1);
				}
			});
	}
	json() {
		return this.response.json(data => data);
	}
	text() {
		return this.response.text(data => data);
	}
	blob() {
		return this.response.blob(data => data);
	}
	static build(response, i = 0) {
		response = new Response(response);
		return response.resolve(i);
	}
}
class Http {
	static config;
	static initialize() {
		Http.config = {
			mode: "cors",
			cache: "default",
			credentials: "same-origin",
			headers: {}
		};
	}
	static delete(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "delete", headers: headers, body: body});
	}
	static get(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "get", headers: headers, body: body});
	}
	static head(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "head", headers: headers, body: body});
	}
	static options(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "options", headers: headers, body: body});
	}
	static patch(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "patch", headers: headers, body: body});
	}
	static post(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "post", headers: headers, body: body});
	}
	static put(url = "/", headers = {}, body = null) {
		return Http.request(url, {method: "put", headers: headers, body: body});
	}
	static request(url = "/", opts = {}) {
		Http.prepareRequest(opts);
		return fetch(url, opts).then(Response.build);
	}
	static prepareRequest(opts) {
		Http.validateOptions(opts);
		opts.mode = Http.config.mode;
		opts.cache = Http.config.cache;
	}
	static validateOptions(opts) {
		if (!opts.method) {
			opts.method = "GET";
		}
		opts.method = opts.method.toUpperCase();
		if (!opts.url) {
			opts.url = "/";
		}
		if (!opts.headers) {
			opts.headers = {};
		}
		Object.keys(Http.config.headers).forEach(function(e) {
			if (Object.keys(opts.headers).indexOf(e) < 0) {
				opts.headers[e] = Http.config.headers[e];
			}
		});
	}
}
class Routes {
	#routes = {"/": {}};
	constructor() {}
	build(opts) {
		if (!!opts.notFound) {
			opts.path = "/--404--"
			opts.component = opts.notFound;
			delete opts.notFound;
			return this.build(opts)
		}
		if (!opts.path) {
			return;
		}
		var path = opts.path;
		var params;
		if ((params = path.match(/\/:\w+/g))) {
			opts.params = [];
			params.forEach(function(e) {
				path = path.replace(e, "/:p");
				opts.params.push(e.replace("/:", ""));
			});
		}
		this.add(path, new Route(opts));
	}
	add(path, route) {
		var components = path.split("/");
		var node = this.#routes["/"];
		components.forEach(function(e, i) {
			if (e) {
				if (!node[e]) {
					node[e] = {$$route: {}};
					if (i == components.length - 1) {
						node[e].$$route = route;
					}
				}
				node = node[e];
			}
			else if (i == components.length - 1) {
				node.$$route = route;
			}
		});
	}
	static draw(arr) {
		arr.forEach(function(r) {
			Routes.instance.build(r);
		});
	}
	dispatch(path) {
		path = Str.trim(path);
		var components = path.split("/");
		var node = this.#routes["/"];
		var route;
		var dyn = [];
		components.forEach(function(e, i) {
			var found = false;
			if (e == "") {
				found = true;
			}
			else if (node[e]) {
				node = node[e];
				found = true;
			}
			else if (node[":p"]) {
				node = node[":p"];
				dyn.push(e);
				found = true;
			}
			if (i == components.length - 1 && found) {
				route = node.$$route;
			}
		});
		if (route) {
			var params = {};
			dyn.forEach(function(e, i) {
				params[route.params[i]] = e;
			});
			return Component.render(route.component, new Instance(route, params), null, Dispatch.router);
		}
		else {
			this.dispatch("404");
		}
	}
}
class Route {
	constructor(opts = {}) {
		if (!opts.component) {
			throw "Component not defined";
		}
		this.component = opts.component;
		this.params = [];
		if (!!opts.params) {
			this.params = opts.params;
		}
	}
}
class Instance {
	constructor(route, params) {
		this.route = route;
		this.params = params;
	}
}
var nil = {
	isNil: function() {
		return true;
	}
};
class Binding {
	constructor(node, expression, index, attr = false, callback = null) {
		this.setNode(node);
		this.length = 0;
		if (expression.indexOf("{{") > -1 && expression.indexOf("}}") > -1) {
			expression = expression.replace("{{", "").replace("}}", "");
			this.length = 4;
		}
		this.expression = expression;
		this.length += this.expression.length;
		this.index = index;
		this.value = undefined;
		this.attr = attr;
		this.callback = callback;
		BindingMap.add(this.node.hashCode, this);
	}
	setNode(node) {
		this.node = node;
		if (!this.node.hashCode) {
			let hashCode = Math.random().toString(36).substring(7);
			this.node.hashCode = (this.attr ? ":a" : "n") + hashCode + (this.attr ? "" : ":");
		}
		else {
			let hashCode = this.node.hashCode.split(":");
			if (this.attr && !hashCode[1]) {
				this.node.hashCode += "a" + Math.random().toString(36).substring(7);
			}
			else if (!this.attr && !hashCode[0]) {
				this.node.hashCode = "n" + Math.random().toString(36).substring(7) + this.node.hashCode;
			}
		}
	}
	compile(obj, callback) {
		let expression = [this.expression];
		if (this.expression.includes(".")) {
			expression = this.expression.split(".");
		}
		obj.invoke((result) => {
			if (expression.length > 1) {
				for (let i = 1; i < expression.length; i++) {
					result = this.evaluateSubExpression(result, expression[i]);
				}
			}
			if (this.callback) {
				return this.callback(this, obj, result);
			}
			var value = Str.stringify(result);
			var changed = value !== this.value;
			if (changed) {
				if (this.value) {
					this.length = this.value.toString().length;
				}
				if (this.attr) {
					this.compileAttr(value);
				}
				else {
					this.compileText(value);
				}
				this.value = value;
			}
			callback(value, changed);
		}, expression[0], [this]);
	}
	compileText(result) {
		if (this.value === undefined) {
			this.node.innerHTML = this.node.innerHTML.replace("{{" + this.expression + "}}", result);
		}
		else {
			this.node.innerHTML = Str.replace(this.node.innerHTML, this.index, result, this.value.length);
		}
	}
	compileAttr(result) {
		if (this.value === undefined) {
			this.attr.value = this.attr.value.replace("{{" + this.expression + "}}", result);
		}
		else {
			this.attr.value = Str.replace(this.attr.value, this.index, result, this.value.length);
		}
	}
	transferTo(node) {
		if (node instanceof Element) {
			node = node.nativeElement;
		}
		var bindings = BindingMap.of(this.node.hashCode);
		bindings.splice(bindings.indexOf(this), 1);
		this.setNode(node);
		BindingMap.add(this.node.hashCode, this);
	}
	evaluateSubExpression(result, subExpression) {
		if (!result) {
			return result;
		}
		else if (Object.keys(result).indexOf(subExpression) > -1) {
			return result[subExpression];
		}
		else if (result[subExpression] instanceof Function) {
			return result[subExpression]();
		}
		else if (result.hasOwnProperty(subExpression)) {
			return result[subExpression];
		}
		else {
			return null;
		}
	}
}
class BindingSibling {
	siblings = [];
	add(binding) {
		this.siblings.push(binding);
	}
	all() {
		return this.siblings;
	}
	compile(obj) {
		var offset = 0, uncompiled = [];
		this.siblings.forEach((e) => {
			e.index += offset;
			e.compile(obj, (result, changed) => {
				if (changed) {
					result = Str.stringify(result);
					offset += result.length - e.length;
					e.length = result.length;
				}
			});
		});
	}
}
class BindingMap {
	#map = {};
	static object;
	static get instance() {
		if (!BindingMap.object) {
			BindingMap.object = new BindingMap;
		}
		return BindingMap.object;
	}
	static add(hashCode, binding) {
		if (!BindingMap.instance.#map[hashCode]) {
			BindingMap.instance.#map[hashCode] = [];
		}
		BindingMap.instance.#map[hashCode].push(binding);
	}
	static of(hashCode) {
		if (!hashCode) {
			return [];
		}
		if (!BindingMap.instance.#map[hashCode]) {
			BindingMap.instance.#map[hashCode] = [];
		}
		return BindingMap.instance.#map[hashCode];
	}
}
class Watch {
	watches = [];
	addBinding(binding) {
		var sibling = new BindingSibling;
		sibling.add(binding);
		this.watches.push(sibling);
	}
	addText(node) {
		var matches;
		if (matches = node.innerHTML.match(/{{\$?\w+(\.\$?\w+)*(\((\$?\w+(\.?\$?\w+)?(,\s*(\$?\w+(\.\$?\w+)?))*)?\))?(\s*[+\-*/]+\s*(\$?\w+(\.\$?\w+)?(\((\$?\w+(\.?\$?\w+)?(,\s*(\$?\w+(\.\$?\w+)?))*)?\))?)*)*}}/g)) {
			var siblings = new BindingSibling;
			for (var match of matches) {
				var index = node.innerHTML.indexOf(match);
				// var prop = match.replace("{{", "").replace("}}", "");
				siblings.add(new Binding(node, match, index));
			}
			this.watches.push(siblings);
		}
	}
	addAttr(node, attrs) {
		var matches;
		for (var attr of attrs) {
			if (matches = attr.value.match(/{{\$?\w+(\.\$?\w+)*}}/g)) {
				var siblings = new BindingSibling;
				for (var match of matches) {
					var index = node.innerHTML.indexOf(match);
					// var prop = match.replace("{{", "").replace("}}", "");
					siblings.add(new Binding(node, match, index, attr));
				}
				this.watches.push(siblings);
			}
		}
	}
	compile(obj, callback) {
		this.watches.forEach(e => {
			e.compile(obj);
		});
	}
}
class Element {
	constructor(el) {
		this.nativeElement = el;
	}
	static create(tagName) {
		return new Element(document.createElement(tagName));
	}
	static find(tag) {
		return Element.findIn(document, tag);
	}
	static findIn(element, tag) {
		var elements = [];
		var nEl = element.querySelectorAll(tag);
		for (var el of nEl) {
			elements.push(new Element(el));
		}
		return elements;
	}
	find(tag) {
		var elements = [];
		var nEl = this.nativeElement.querySelectorAll(tag);
		for (var el of nEl) {
			elements.push(new Element(el));
		}
		return elements;
	}
	get nodeName() {
		return this.nativeElement.nodeName;
	}
	get innerHTML() {
		return this.nativeElement.innerHTML;
	}
	set innerHTML(html) {
		this.nativeElement.innerHTML = html;
	}
	get attributes() {
		return this.nativeElement.attributes;
	}
	get style() {
		return this.nativeElement.style;
	}
	addClass(cls) {
		this.nativeElement.classList.add(cls);
	}
	removeClass(cls) {
		this.nativeElement.classList.remove(cls);
	}
	toggleClass(cls) {
		this.nativeElement.classList.toggle(cls);
	}
	hasClass(cls) {
		return this.nativeElement.classList.contains(cls);
	}
	append(element) {
		if (element instanceof Element) {
			element = element.nativeElement;
		}
		this.nativeElement.append(element);
	}
	remove() {
		this.nativeElement.remove();
	}
	get hashCode() {
		return this.nativeElement.hashCode;
	}
	set hashCode(hc) {
		this.nativeElement.hashCode = hc;
	}
	on(event, handler) {
		this.nativeElement.addEventListener(event, handler);
	}
}
class Component {
	templateUrl = "";
	template = "";
	styleSheets = [];
	selector = "ag-view";
	element = false;
	includes = [];
	innerHTML = "";
	$children = [];
	#callback = null;
	parent = false;
	watches = new Watch;
	constructor(element = false, parent = false) {
		this.element = element;
		this.parent = parent;
		if (this.element && this.parent) {
			this.fetch();
		}
	}
	static render(component, instance = {}, callback = null, parent = false) {
		var dispatch = new component();
		dispatch.init(instance, callback, parent);
		return dispatch;
	}
	init(instance, callback, parent) {
		this.instance = instance;
		this.#callback = callback;
		this.parent = parent;
		this.fetch();
	}
	onInit() {

	}
	fetch(obj = "template") {
		if (obj == "template") {
			if (this.templateUrl) {
				Http.get(Dispatch.baseHref + this.templateUrl)
					.then(res => {
						this.renderTemplate(res.data);
					});
			}
			else if (this.template) {
				this.renderTemplate(this.template);
			}
			else {
				this.onInit();
			}
		}
		else if (obj == "styleSheets") {
			this.styleSheets.forEach(function(e) {
				Http.get(e)
					.then(res => {
						var style = document.createElement("style");
						style.innerHTML = res.data;
						document.getElementsByTagName(this.selector)[0].prepend(style);
					});
			});
		}
	}
	renderTemplate(data) {
		if (!this.element) {
			if (this.parent) {
				this.element = this.parent.element.find(this.selector)[0];
			}
			else {
				this.element = Element.find(this.selector)[0];
			}
		}
		this.innerHTML = this.element.nativeElement.innerHTML;
		for (var e of this.element.nativeElement.childNodes) {
			this.$children.push(e);
		};
		this.element.nativeElement.innerHTML = data;
		this.onInit();
		this.fetch("styleSheets");
		this.renderIncludes();
		if (document.getElementsByTagName(this.selector)[0].getElementsByTagName("ag-view").length) {
			Dispatch.router = this;
		}
		if (this.#callback) {
			this.#callback();
		}
		Dispatch.compile(this);
	}
	include(...args) {
		this.includes = args;
	}
	renderIncludes() {
		this.includes.forEach(component => {
			Dispatch.addComponent(Component.render(component, {}, null, this));
		});
	}
	compile() {
		this.watches.compile(this);
	}
	compileOne(watch) {
		if (!watch.compile(this) && this.parent) {
			this.parent.compileOne(watch);
		}
	}
	invoke(callback, member, args = []) {
		if (Object.keys(this).indexOf(member) > -1) {
			callback(this[member]);
		}
		else if (this[member] instanceof Function) {
			callback(this[member](...args));
		}
		else if (this.parent) {
			this.parent.invoke(callback, member, args);
		}
		else {
			callback(undefined);
		}
	}
}
class DirectiveTypes {
	static get Element() {
		return "e";
	}
	static get Attribute() {
		return "a";
	}
}
class Directive extends Component {
	static type() {
		return DirectiveTypes.Element;
	}
}
class AgClick extends Directive {
	selector = "ag-click";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		this.attr = this.element.attributes.getNamedItem("ag-click");
		this.element.nativeElement.addEventListener("click", (event) => {
			this.parent.invoke(() => {}, this.attr.value.replace("()", ""), [event]);
		});
	}
}
class AgSubmit extends Directive {
	selector = "ag-submit";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		this.attr = this.element.attributes.getNamedItem("ag-submit");
		this.element.nativeElement.addEventListener("submit", (event) => {
			event.preventDefault();
			this.parent.invoke(() => {}, this.attr.value.replace("()", ""), [event]);
		});
	}
}
class AgInput extends Directive {
	selector = "ag-input";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		this.attr = this.element.attributes.getNamedItem("ag-input");
		this.element.nativeElement.addEventListener("input", (event) => {
			this.parent.invoke(() => {}, this.attr.value.replace("()", ""), [event]);
		});
	}
}
class AgShow extends Directive {
	selector = "ag-show";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		this.attr = this.element.attributes.getNamedItem("ag-show");
		if (this.attr) {
			this.watches.addBinding(new Binding(this.element.nativeElement, this.attr.value, 0, this.attr, (binding, obj, val) => {
				if (!val) {
					this.element.addClass("ag-hide");
				}
				else {
					this.element.removeClass("ag-hide");
				}
			}));
			Dispatch.compile(this);
			Dispatch.addComponent(this);
		}
	}
}
class AgModel extends Directive {
	selector = "ag-model";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		this.identifyType();
		this.attr = this.element.attributes.getNamedItem("ag-model");
		if (this.isInput) {
			this.element.nativeElement.addEventListener("input", (event) => {
				this.parent[this.attr.value] = this.element.nativeElement.value;
			});
		}
		Dispatch.compile(this);
		Dispatch.addComponent(this);
	}
	compile() {
		this.parent.invoke((val) => {
			if (this.isInput) {
				this.element.nativeElement.value = val;
			}
			else {
				this.element.innerHTML = val;
			}
		}, this.attr.value);
	}
	identifyType() {
		this.isInput = (this.element.nodeName == "SELECT" || this.element.nodeName == "INPUT");
	}
}
class AgFor extends Directive {
	selector = "ag-for";
	static indexAttr() {
		return "ag-afi";
	}
	onInit() {
		this.loopAttr = this.element.attributes.getNamedItem("loop");
		if (!this.loopAttr) {
			return;
		}
		this.compileLoopExpression();
		this.loopContent = [];
		this.loop = [];
		for (var node of this.element.nativeElement.children) {
			var clone = node.cloneNode(true);
			clone.hashCode = undefined;
			this.loopContent.push(clone);
		}
		this.removeChildren(this.element.nativeElement.children.length);
		this.invoked = false;
		Dispatch.compile(this);
		Dispatch.addComponent(this);
	}
	compileLoopExpression() {
		this.keyName = this.iteratorName = this.loopOverName = "";
		var hasKey = false;
		this.loopExpression = this.loopAttr.value.trim().replace(" in ", " ");
		for (var i = 0; i < this.loopExpression.length; i++) {
			if (!this.iteratorName && this.loopExpression[i] == "(") {
				hasKey = true;
				continue;
			}
			if (hasKey && !this.keyName) {
				while (this.loopExpression[i] != ",") {
					this.keyName += this.loopExpression[i++];
				}
				i++;
			}
			if (!this.iteratorName) {
				var delimiter = hasKey ? ")" : " ";
				while (this.loopExpression[i] != delimiter) {
					this.iteratorName += this.loopExpression[i++];
				}
				if (hasKey) {
					i++;
				}
			}
			this.loopOverName += this.loopExpression[i];
		}
		this.keyName = this.keyName.trim();
		this.iteratorName = this.iteratorName.trim();
		this.loopOverName = this.loopOverName.trim();
	}
	compile() {
		if (this.invoked) {
			this.compileContent();
		}
		else {
			this.compileLoop();
		}
	}
	compileContent() {
		this.watches.compile(this);
		this.invoked = false;
		return;
	}
	compileLoop() {
		let expression = [this.loopOverName];
		if (this.loopOverName.includes(".")) {
			expression = this.loopOverName.split(".");
		}
		this.parent.invoke((val) => {
			if (expression.length > 1) {
				for (let i = 1; i < expression.length; i++) {
					val = this.evaluateSubExpression(val, expression[i]);
				}
			}
			var count = this.keyName ? Object.keys(val).length : (val ? val.length : 0);
			if (count != this.loop.length) {
				this.redraw(count - this.loop.length);
			}
			this.loop = [];
			if (this.keyName) {
				for (var each in val) {
					var obj = {};
					obj[this.keyName] = each;
					obj[this.iteratorName] = val[each];
					this.loop.push(obj);
				}
			}
			else {
				if (val) {
					for (var each of val) {
						this.loop.push(each);
					}
				}
			}
			this.invoked = true;
			Dispatch.compile(this);
		}, expression[0]);
	}
	redraw(difference) {
		if (difference > 0) {
			this.drawChildren(difference);
		}
		else {
			this.removeChildren(-difference);
		}
	}
	removeChildren(count) {
		while (count && this.element.nativeElement.lastElementChild) {
			this.element.nativeElement.removeChild(this.element.nativeElement.lastElementChild);
			count--;
		}
	}
	drawChildren(count) {
		var index = this.loop.length;
		while (count) {
			for (var node of this.loopContent) {
				var clone = node.cloneNode(true);
				clone.setAttribute(AgFor.indexAttr(), index++);
				this.element.append(clone);
			}
			count--;
		}
	}
	invoke(callback, method, args = []) {
		var node = args[0].node;
		var afi = false;
		while (!(afi = node.attributes.getNamedItem(AgFor.indexAttr()))) {
			node = node.parentNode;
		}
		var index = afi.value;
		if (method.includes("$index")) {
			method = method.replace("$index", index);
			callback(eval(method));
		}
		else if (this.keyName) {
			callback(this.loop[index][method]);
		}
		else {
			callback(this.loop[index]);
		}
	}
	evaluateSubExpression(result, subExpression) {
		if (!result) {
			return result;
		}
		else if (Object.keys(result).indexOf(subExpression) > -1) {
			return result[subExpression];
		}
		else if (result[subExpression] instanceof Function) {
			return result[subExpression]();
		}
		else if (result.hasOwnProperty(subExpression)) {
			return result[subExpression];
		}
		else {
			return null;
		}
	}
}
class AgRipple extends Directive {
	selector = "ag-ripple";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		if (this.element.hasClass("ag-ripple")) {
			return;
		}
		this.element.addClass("ag-ripple");
		this.ripple = Element.create("div");
		this.ripple.addClass("ripple");
		this.element.append(this.ripple);
		this.element.nativeElement.addEventListener("mousedown", e => {
			this.ripples(e, this);
		});
		this.element.nativeElement.addEventListener("mouseup", e => {
			this.ripplesOut(e, this);
		});
	}
	ripples(ev, el) {
		var buttonWidth = el.offsetWidth + 5,
		buttonHeight =  el.offsetHeight + 5;
		if (buttonWidth >= buttonHeight) {
			buttonHeight = buttonWidth;
		}
		else {
			buttonWidth = buttonHeight;
		}
		var x = ev.pageX - el.offsetLeft - buttonWidth;
		var y = ev.pageY - el.offsetTop - buttonHeight;
		// Add the ripples CSS and start the animation
		this.rippler = Element.create("div");
		this.ripple.append(this.rippler);
		this.rippler.addClass("ripple-effect");
		window.setTimeout(() => {
			this.rippler.style.left = x + "px";
			this.rippler.style.top = y + "px";
			this.rippler.style.height = (buttonHeight * 2) + "px";
			this.rippler.style.width = (buttonWidth * 2) + "px";
			this.rippler.style.transform = "scale(1)";
		}, 5);
	}
	ripplesOut(ev, el) {
		window.setTimeout(() => {
			c.rippler.style.opacity = 0;
			window.setTimeout(() => {
				this.rippler.remove();
			}, 200);
		}, 200);
	}
}
class AgButton extends AgRipple {
	onInit() {
		if (this.element.hasClass("ag-button")) {
			return;
		}
		this.element.addClass("ag-button");
		var span = document.createElement("span");
		span.classList.add("ag-button-title");
		span.innerHTML = this.element.innerHTML;
		this.element.innerHTML = "";
		this.element.append(span);
		this.transferBindingsTo(span);
		super.onInit();
	}
	transferBindingsTo(span) {
		var bindings = BindingMap.of(this.element.hashCode);
		for (var b of bindings) {
			b.transferTo(span);
		}
	}
}
class Application {
	constructor() {
		this.onRun = false;
		this.hold = false;
		Application.initNativeComponents();
		this.baseComponent = "";
		Routes.instance = new Routes;
		this.init();
	}
	run(onRun = false) {
		if (onRun) {
			this.onRun = onRun;
		}
		if (this.hold) {
			return;
		}
		let location = window.location.pathname;
		location = location.replace(Dispatch.baseHref.pathname, "");
		if (location.includes("index.html")) {
			location = Str.trim(location.replace("index.html", "")) + "/";
		}
		if (this.baseComponent) {
			Dispatch.addComponent(Component.render(this.baseComponent, {}, () => {
				this.onRun(Routes.instance.dispatch(location));
			}));
		}
		else {
			this.onRun(Routes.instance.dispatch(location));
		}
	}
	bootstrap(component) {
		this.baseComponent = component;
	}
	import(components) {
		this.hold = true;
		for (var i = 0; i < components.length; i++) {
			this.include(components[i], i == components.length - 1);
		}
	}
	static initNativeComponents() {
		Application.nativeComponents = {
			"AgNavbar": "/js/components/ag_navbar/ag_navbar.js"
		}
		Application.nativeDirectives = [AgClick, AgModel, AgSubmit, AgShow, AgInput, AgFor, AgRipple, AgButton];
	}
	include(component, last = false) {
		if (!!Application.nativeComponents[component]) {
			Http.get(Application.nativeComponents[component])
				.then(res => {
					var script = document.createElement("script");
					script.innerHTML = res.data;
					document.head.appendChild(script);
					if (last) {
						this.hold = false;
						this.run();
					}
				});
		}
		else {
			throw "Could not find component " + component;
		}
	}
}
class Dispatch {
	static init() {
		Http.initialize();
		Dispatch.base = false;
		Dispatch.baseHref = new URL(document.getElementsByTagName("BASE")[0].href);
		Dispatch.router = false;
		Dispatch.components = [];
		Dispatch.setNavigationHandler();
		var app = new AgApplication;
		app.run(Dispatch.addComponent);
		Dispatch.refreshing = false;
		Dispatch.initializing = true;
	}
	static setNavigationHandler() {
		document.addEventListener("click", function(e) {
			Dispatch.onClick(e, e.target);
		});
		document.addEventListener("input", function(e) {
			Dispatch.refresh();
		})
		window.onpopstate = function(event) {
			Dispatch.navigateTo(window.location.pathname);
		}
	}
	static navigateTo(location, event = {}) {
		window.history.pushState(event, "", location);
		Dispatch.addComponent(Routes.instance.dispatch(location));
	}
	static onClick(ev, el) {
		if (el.tagName == "A") {
			if (el.hostname == window.location.hostname) {
				ev.preventDefault();
				Dispatch.navigateTo(el.pathname);
			}
		}
		else {
			Dispatch.refresh();
		}
	}
	static addComponent(component) {
		if (!Dispatch.base) {
			Dispatch.base = component;
		}
		Dispatch.components.push(component);
	}
	static compile(component) {
		Dispatch.compileText(component);
		Dispatch.compileAttr(component);
		Dispatch.compileNativeDirectives(component);
		component.compile();
	}
	static compileText(component) {
		var node, match, xPathRes = document.evaluate(".//*[contains(text(),'{{')]", component.element.nativeElement, null, XPathResult.ANY_TYPE, null);
		while (node = xPathRes.iterateNext()) {
			if (!node.hashCode) {
				component.watches.addText(node);
			}
			else {
				let hashCode = node.hashCode.split(":");
				if (!hashCode[0]) {
					component.watches.addText(node);
				}
			}
		}
	}
	static compileAttr(component) {
		var node, match, xPathRes = document.evaluate(".//*[contains(@*,'{{')]", component.element.nativeElement, null, XPathResult.ANY_TYPE, null);
		while (node = xPathRes.iterateNext()) {
			if (!!node.hashCode) {
				let hashCode = node.hashCode.split(":");
				if (hashCode[1]) {
					continue;
				}
			}
			var attrs = [], attr, attrXPath = document.evaluate("//@*[contains(.,'{{')]", node, null, XPathResult.ANY_TYPE, null);
			while (attr = attrXPath.iterateNext()) {
				attrs.push(attr);
			}
			component.watches.addAttr(node, attrs);
		}
	}
	static compileNativeDirectives(component) {
		Application.nativeDirectives.forEach(function(e) {
			var type = e.type(), selector = Str.snakeCase(e.name, "-");
			if (type == DirectiveTypes.Attribute) {
				selector = "[" + selector + "]";
			}
			var elements = component.element.find(selector);
			for (var element of elements) {
				var c = new e(element, component);
			}
		});
	}
	static refresh() {
		if (Dispatch.initializing) {
			Dispatch.initializing = false;
			setInterval(Dispatch.refresh, 100);
		}
		if (Dispatch.refreshing) {
			return;
		}
		Dispatch.refreshing = true;
		Dispatch.components.forEach(function(e) {
			e.compile();
		});
		Dispatch.refreshing = false;
	}
}
class Str {
	static trim(url, char = "/") {
		url = url.replace(new RegExp("^([" + char + "]*)", "g"), '');
		return url.replace(new RegExp("([" + char + "]*)$", "g"), '');
	}
	static replace(string, start, replace, length = false) {
		length = length !== false ? length : replace.length;
		return string.substr(0, start) + replace + string.substr(start + length);
	}
	static snakeCase(string, delimiter = "_") {
		return string.split(/(?=[A-Z])/).join(delimiter).toLowerCase();
	}
	static stringify(value) {
		var ret = value;
		try {
			ret = value.toString();
		}
		catch (e) {
			ret = value || "";
		}
		return ret;
	}
}
window.addEventListener("load", Dispatch.init);