class Response {
	constructor(response) {
		this.status = response.status;
		this.response = response;
		this.headers = {"content-type": ""};
		this.data = "";
		this.parseHeaders();
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
		if (this.status >= 200 && this.status < 300) {
			return this.parseData();
		}
		else {
			return Promise.reject(this);
		}
	}
	parseData() {
		let r = this;
		let contentType = this.headers["content-type"];
		if (contentType == "application/json") {
			return this.response.json().then((data) => {
				r.data = data;
				return r;
			});
		}
		else if (contentType.indexOf("text/") > -1 || contentType == "application/javascript") {
			return this.response.text().then((data) => {
				r.data = data;
				return r;
			});
		}
		else {
			return this.response.blob().then((data) => {
				r.data = data;
				return r;
			});
		}
	}
	static build(response) {
		response = new Response(response);
		return response.resolve();
	}
}
class Http {
	static config;
	static initialize() {
		Http.config = {
			mode: "no-cors",
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
		path = String.trim(path);
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
			this.node.hashCode = Math.random().toString(36).substring(7);
		}
	}
	compile(obj, callback) {
		if (this.callback) {
			return this.callback(this, obj);
		}
		obj.invoke((result) => {
			var changed = false;
			if (result != this.value) {
				if (this.value) {
					this.length = this.value.toString().length;
				}
				var value = String.stringify(result);
				if (this.attr) {
					this.compileAttr(value);
				}
				else {
					this.compileText(value);
				}
				this.value = value;
				changed = true;
			}
			callback(result, changed);
		}, this.expression, [this]);
	}
	compileText(result) {
		if (this.value === undefined) {
			this.node.innerHTML = this.node.innerHTML.replace("{{" + this.expression + "}}", result);
		}
		else {
			this.node.innerHTML = String.replace(this.node.innerHTML, this.index, result, this.value.length);
		}
	}
	compileAttr(result) {
		if (this.value === undefined) {
			this.attr.value = this.attr.value.replace("{{" + this.expression + "}}", result);
		}
		else {
			this.attr.value = String.replace(this.attr.value, this.index, result, this.value.length);
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
		this.siblings.forEach(function(e) {
			e.index += offset;
			e.compile(obj, (result, changed) => {
				if (changed) {
					result = String.stringify(result);
					offset += result.length - e.length;
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
class Ast {
	left = "";
	right = "";
	operator = "";
}
class Expression {
	#ast = new Ast();
	constructor(exp) {
		this.exp = exp.trim();
	}
	compile() {
		var type = false, offset = 0;
		if (Expression.isNumeric(this.exp[0])) {
			type = "n";
		}
		else if (Expression.isAlphabet(this.exp[0])) {
			type = "a";
		}
		else if (this.exp[0] == '(') {
			type = "e";
			offset = 1;
		}
		for (i = offset; i < this.exp.length; i++) {
			var id = "";
			if (type == "a") {
				while (Expression.isAlphaNum(this.exp.charCodeAt(i))) {
					id += this.exp[i++];
				}
				if (i == this.exp.length - 1) {
					this.#ast.right = id;
					continue;
				}
			}
			else if (type == "n") {
				while (Expression.isNumeric(this.exp.charCodeAt(i))) {
					id += this.exp[i++] + "";
				}
				if (i == this.exp.length - 1) {
					this.#ast.right = id;
					continue;
				}
			}
			else {
				if (i == this.exp.length - 1) {
					this.#ast.right = id;
					continue;
				}
				while (this.exp[i++] == " ") {}
				var operator = "";
				if (this.exp[i] == "=") {
					operator = "=";
					i++;
					if (this.exp[i] == "=") {
						operator = "==";
						i++;
					}
				}
				else if (this.exp[i] == "+" || this.exp[i] == "-" || this.exp[i] == "*" || this.exp[i] == "/") {
					operator = this.exp[i];
					i++;
				}
				if (operator && id) {
					this.#ast.left = id;
					this.#ast.operator = operator;
					this.#ast.right = (new Expression(this.exp.substr(i))).compile();
				}
			}
		}
		return this.#ast;
	}
	static isAlphabet(c) {
		return (c > 64 && c < 91) || (c > 96 && c < 123) || c == 95;
	}
	static isNumeric() {
		return c > 47 && c < 58;
	}
	static isAlphaNum(c) {
		return Expression.isNumeric(c) || Expression.isAlphabet(c);
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
		if (matches = node.innerHTML.match(/{{\$?\w+(\.\$?\w+)?(\((\$?\w+(\.?\$?\w+)?(,\s*(\$?\w+(\.\$?\w+)?))*)?\))?(\s*[+\-*/]+\s*(\$?\w+(\.\$?\w+)?(\((\$?\w+(\.?\$?\w+)?(,\s*(\$?\w+(\.\$?\w+)?))*)?\))?)*)*}}/g)) {
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
			if (matches = attr.value.match(/{{(\w+)}}/g)) {
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
		this.watches.forEach(function(e) {
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
				var c = this;
				Http.get(this.templateUrl)
					.then(function(res) {
						c.renderTemplate(res.data);
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
			var c = this;
			this.styleSheets.forEach(function(e) {
				Http.get(e)
					.then(function(res) {
						var style = document.createElement("style");
						style.innerHTML = res.data;
						document.getElementsByTagName(c.selector)[0].prepend(style);
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
		var c = this;
		this.includes.forEach(function(component) {
			Dispatch.addComponent(Component.render(component, {}, null, c));
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
	invoke(callback, method, args = []) {
		if (Object.keys(this).indexOf(method) > -1) {
			callback(this[method]);
		}
		else if (this[method] instanceof Function) {
			callback(this[method](...args));
		}
		else if (this.parent) {
			this.parent.invoke(callback, method, args);
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
class AgShow extends Directive {
	selector = "ag-show";
	static type() {
		return DirectiveTypes.Attribute;
	}
	onInit() {
		this.attr = this.element.attributes.getNamedItem("ag-show");
		if (this.attr) {
			this.watches.addBinding(new Binding(this.element.nativeElement, this.attr.value, 0, this.attr, (binding, obj) => {
				this.parent.invoke((val) => {
					if (!val) {
						this.element.addClass("ag-hide");
					}
					else {
						this.element.removeClass("ag-hide");
					}
				}, this.attr.value);
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
		var c = this;
		this.element.nativeElement.addEventListener("mousedown", function(e) {
			c.ripples(e, this);
		});
		this.element.nativeElement.addEventListener("mouseup", function(e) {
			c.ripplesOut(e, this);
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
		var c = this;
		window.setTimeout(function() {
			c.rippler.style.opacity = 0;
			window.setTimeout(function() {
				c.rippler.remove();
			}, 200);
		}, 200);
	}
}
class AgButton extends AgRipple {
	onInit() {
		if (this.element.hasClass("ag-button")) {
			return;
		}
		var c = this;
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
		if (this.baseComponent) {
			var app = this;
			Dispatch.addComponent(Component.render(this.baseComponent, {}, function() {
				app.onRun(Routes.instance.dispatch(window.location.pathname));
			}));
		}
		else {
			this.onRun(Routes.instance.dispatch(window.location.pathname));
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
		Application.nativeDirectives = [AgClick, AgShow, AgModel, AgRipple, AgButton];
	}
	include(component, last = false) {
		if (!!Application.nativeComponents[component]) {
			var app = this;
			Http.get(Application.nativeComponents[component])
				.then(function(res) {
					var script = document.createElement("script");
					script.innerHTML = res.data;
					document.head.appendChild(script);
					if (last) {
						app.hold = false;
						app.run();
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
		Dispatch.router = false;
		Dispatch.components = [];
		Dispatch.setNavigationHandler();
		var app = new AgApplication;
		app.run(Dispatch.addComponent);
		Dispatch.refreshing = false;
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
		var element = document.getElementsByTagName(component.selector)[0];
		var node, match, xPathRes = document.evaluate(".//*[contains(text(),'{{')]", element, null, XPathResult.ANY_TYPE, null);
		while (node = xPathRes.iterateNext()) {
			if (!node.hashCode) {
				component.watches.addText(node);
			}
		}
	}
	static compileAttr(component) {
		var element = document.getElementsByTagName(component.selector)[0];
		var node, match, xPathRes = document.evaluate(".//*[contains(@*,'{{')]", element, null, XPathResult.ANY_TYPE, null);
		while (node = xPathRes.iterateNext()) {
			if (!!node.hashCode) {
				continue;
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
			var type = e.type(), selector = String.snakeCase(e.name, "-");
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
class String {
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