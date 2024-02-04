function Funa<T extends FunaInit>(this: Funa<T>, init?: FunaInit) {
	if (!new.target) {
		throw new Error('Funa() must be called with new');
	}
	
	const instance = this;
	
	//#
	//# include "parser.ts"
	//# include "observer.ts"
	//#
	
	if (!init) {
		init = {};
	}
	
	/**
	 * Specifies tags to bypass during parsing.
	 */
	ExprParser.bypass = ['TEMPLATE', 'PRE', 'CODE', ...(init.config?.bypassTags || []).map(tag => tag.toUpperCase())];
	
	/**
	 * Assigns init fields into the `instance` as read-only properties.
	 */
	['data', 'as', 'if', 'is', 'on'].forEach(field => Object.defineProperty(instance, field, {
		value: init[field] || {}
	}));
	
	/**
	 * Stores declarative expressions of parsed templates.
	 */
	const templates: Record<string, (Node | NodeExpr | TextExpr)[]> = {};
	
	/**
	 * Stores un-watch callbacks of rendered DOM.
	 */
	const watchdom: WeakMap<Node, Function[]> = new WeakMap;
	
	/**
	 * Gets callback function from its name.
	 */
	function getHandler<Fn>(dict: Record<string, Fn>, fn: FnExpr): Fn {
		let name = fn.name;
		if (!(name in dict)) {
			throw new Error('Callback is not defined: ' + name);
		}
		return dict[name];
	}
	
	/**
	 * Deep observes objects.
	 * 
	 * Returns a signal for cancelling the observation.
	 */
	function deepWatch(data: any, path: string[], callback: Function): () => void {
		let maps = [];
		
		function observe(k: number) {
			let init = (k in maps);
			let last = (k === path.length - 1);
			
			let refs = parseData(data, path.slice(0, k));
			let prop = path[k];
			
			if (init) {
				ObjectObserver.remove.apply(undefined, maps[k]);
			}
			
			maps[k] = [refs, prop, last ? callback : observe.bind(undefined, k)];
			ObjectObserver.listen.apply(undefined, maps[k]);
			
			if (!last) {
				observe(k + 1);
			}
			else if (init) {
				ObjectObserver.notify(refs, prop);
			}
		}
		
		function cancel() {
			maps.forEach(item => ObjectObserver.remove.apply(undefined, item));
			maps = undefined;
		}
		
		observe(0);
		
		return cancel;
	}
	
	/**
	 * Removes all the deep watched callbacks that associated with the DOM.
	 * 
	 * Sets the `remove` parameter to `true` to remove the node from DOM tree as well.
	 */
	function unWatch(child: Node, remove = false) {
		if (child.nodeType === Node.ELEMENT_NODE) {
			for (let node of child.childNodes) {
				unWatch(node);
			}
		}
		
		if (watchdom.has(child)) {
			watchdom.get(child).forEach(unsub => unsub());
			watchdom.delete(child);
		}
		
		if (remove) {
			child.parentElement?.removeChild(child);
		}
	}
	
	/**
	 * Accesses to an object's properties by using the dot notation.
	 */
	function parseData(data: any, path: string[]): any {
		for (let prop of path) {
			if (data != undefined) {
				data = data[prop];
			}
		}
		return data;
	}
	
	/**
	 * Resolves text value from expression, applies custom formatting if needed.
	 */
	function parseRun(text: TextExpr, data: any): any {
		if (text.run) {
			return text.run;
		}
		else if (text.src) {
			let run = (text.src.prop === '?') ? data : parseData(data, text.src.path);
			if (text.fmt) {
				let fmt = getHandler(instance.as, text.fmt);
				if (!fmt.convert) {
					throw new Error('Format convert is not defined: ' + text.fmt.name);
				}
				run = fmt.convert.call(data, run, ...text.fmt.args);
			}
			return run;
		}
	}
	
	/**
	 * Renders text node from expression.
	 */
	function parseText(text: TextExpr, target: Element, data: any, append: boolean): Text {
		let node = new Text;
		
		function run() {
			node.nodeValue = parseRun(text, data) ?? '';
		}
		
		run();
		
		if (text.src && text.src.bind) {
			watchdom.set(node, [deepWatch(data, text.src.path, run)]);
		}
		
		if (append) {
			target.append(node);
		}
		
		return node;
	}
	
	/**
	 * Creates two-way data binding from expression.
	 */
	function parseBind(attr: AttrExpr, target: Element, data: any): void {
		let name = attr.name;
		let at = attr.at;
		let src = at.src;
		let fmt: any;
		
		if (src.path.length > 1) {
			throw new Error('Nested data binding is not supported: ' + src.path.join('.'));
		}
		
		if (at.fmt) {
			fmt = getHandler(instance.as, at.fmt)?.revert;
			if (!fmt) {
				throw new Error('Format revert is not defined: ' + at.fmt.name);
			}
		}
		
		let pre = at.pre ? getHandler(instance.on, at.pre) : undefined;
		
		let post = at.post ? getHandler(instance.on, at.post) : undefined;
		
		target.addEventListener(at.evt, (event) => {
			if (pre) {
				pre.call(data, target, event, ...at.pre.args);
			}
			
			let value = attr.prop ? target[name] : target.getAttribute(name);
			if (fmt) {
				value = fmt.call(data, value, ...at.fmt.args);
			}
			data[src.prop] = value;
			
			if (post) {
				post.call(data, target, event, ...at.post.args);
			}
		});
		
		////
		
		function run() {
			let s = parseRun(<TextExpr>at, data);
			attr.prop ? target[name] = s : target.setAttribute(name, s);
		}
		
		run();
		
		watchdom.set(target, [deepWatch(data, src.path, run)]);
	}
	
	/**
	 * Sets attribute/property into DOM element.
	 */
	function parseAttr(attr: AttrExpr, target: Element, data: any): void {
		let name = attr.name;
		
		let direct = (attr.text.length === 1);
		
		function run() {
			let s = direct ? parseRun(attr.text[0], data) : attr.text.reduce((acc, cur) => acc += parseRun(cur, data) ?? '', '');
			attr.prop ? target[name] = s : target.setAttribute(name, s ?? '');
		}
		
		run();
		
		for (let text of attr.text) {
			if (text.src && text.src.bind) {
				watchdom.set(target, [deepWatch(data, text.src.path, run)]);
			}
		}
	}
	
	/**
	 * Loops through array source and renders each element.
	 */
	function parseArray(node: NodeExpr, target: Element, data: any[]): () => void {
		const map: Node[][] = [];
		
		function insert(event: ArrayInsert) {
			let ref = (event.index < map.length) ? map[event.index][0] : null;
			
			event.items.forEach((item, i) => {
				let arr = [];
				for (let child of node.children) {
					let e = parseNode(child, target, item, false);
					if (e) {
						target.insertBefore(e, ref);
						arr.push(e);
					}
				}
				map.splice(event.index + i, 0, arr);
			});
		}
		
		function remove(event: ArrayRemove) {
			map.splice(event.index, event.items.length).forEach(arr => arr.forEach(item => unWatch(item, true)));
		}
		
		function change(event: ArrayChange[]) {
			let n = event.length;
			let tmp = new Array(n);
			for (let i = 0; i < n; i++) {
				tmp[i] = map[event[i].before];
			}
			for (let i = 0; i < n; i++) {
				map[event[i].after] = tmp[i];
			}
			for (let i = n - 1; i >= 0; i--) {
				let idx = event[i].after + 1;
				let ref = (idx < map.length) ? map[idx][0] : null;
				let old = tmp[i];
				for (let k = 0; k < old.length; k++) {
					target.insertBefore(old[k], ref);
				}
			}
		}
		
		function init() {
			insert({ index: 0, items: data });
			
			ArrayObserver.observe(data);
			ArrayObserver.listen(data, insert, remove, change);
		}
		
		function cancel() {
			ArrayObserver.remove(data, insert, remove, change);
			
			map.splice(0).forEach(arr => arr.forEach(item => unWatch(item, true)));
		}
		
		init();
		
		return cancel;
	}
	
	/**
	 * Renders DOM element from expression.
	 */
	function parseElement(node: NodeExpr, target: Element, data: any, append: boolean): Element {
		let root = data;
		let copy = document.createElement(node.tag);
		let expr = node.bind;
		let subs = [];
		
		if (expr.src) {
			if (expr.src.bind) {
				subs.push(deepWatch(root, expr.src.path, function () {
					let temp = parseElement(node, target, root, false);
					copy.replaceWith(temp);
					unWatch(copy, true);
				}));
			}
			data = parseData(root, expr.src.path);
		}
		
		if (expr.if) {
			let hnd = expr.if.hnd;
			let test = Boolean(
				hnd.args ?
				getHandler(instance.if, hnd).call(data, ...hnd.args) :
				parseData(data, hnd.name.split('.'))
			);
			if (expr.if.not) {
				test = !test;
			}
			if (!test) {
				return;
			}
		}
		
		if (expr.tpl) {
			parseTemplate(expr.tpl.name, target, data);
			return;
		}
		
		for (let item of node.attr) {
			if (item.at) {
				parseBind(item, copy, data);
			}
			else {
				parseAttr(item, copy, data);
			}
		}
		
		if (Array.isArray(data)) {
			subs.push(parseArray(node, copy, data));
		}
		else {
			for (let child of node.children) {
				parseNode(child, copy, data);
			}
		}
		
		if (expr.on) {
			let defer: any;
			
			for (let item of expr.on) {
				let func = getHandler(instance.on, item.hnd);
				let args = item.hnd.args;
				
				if (item.evt) {
					copy.addEventListener(item.evt, (event) => {
						func.call(data, copy, event, ...args);
					});
				}
				else {
					defer = func.bind(data, copy, undefined, ...args);
				}
			}
			
			if (defer) {
				defer();
			}
		}
		
		if (subs.length) {
			watchdom.set(copy, subs);
		}
		
		if (append) {
			target.appendChild(copy);
		}
		
		return copy;
	}
	
	/**
	 * Renders DOM node from expression.
	 */
	function parseNode(child: Node | NodeExpr | TextExpr, target: Element, data: any, append = true): Node {
		let e: Node;
		if (child instanceof Node) {
			e = child.cloneNode(true);
			if (append) {
				target.append(e);
			}
		}
		else if ('tag' in child) {
			e = parseElement(child, target, data, append);
		}
		else {
			e = parseText(child, target, data, append);
		}
		return e;
	}
	
	/**
	 * Renders specified template.
	 */
	function parseTemplate(name: string, target: Element, data: any): void {
		for (let child of templates[name]) {
			parseNode(child, target, data);
		}
	}
	
	/**
	 * Implicitly applying custom formatting based on model metadata.
	 */
	function parseModel(expr: (Node | TextExpr | NodeExpr)[], model?: FunaIs): void {
		function resolve(path: string[]): string | FunaIs {
			let temp: string | FunaIs = model;
			for (let prop of path) {
				if (!(temp = temp[prop])) {
					break;
				}
			}
			return temp;
		}
		
		for (let item of expr) {
			if ('tag' in item) {
				if (item.bind.is) {
					model = getHandler(instance.is, item.bind.is);
				}
				else if (item.bind.src && model) {
					let temp = resolve(item.bind.src.path);
					model = (typeof temp === 'object') ? temp : undefined;
				}
				
				for (let attr of item.attr) {
					if (attr.at && !attr.at.fmt && model) {
						let temp = resolve(attr.at.src.path);
						if (typeof temp === 'string') {
							attr.at.fmt = { name: temp, args: [] };
						}
					}
				}
				
				parseModel(item.children, model);
			}
			else if ('src' in item) {
				if (!item.fmt && model) {
					let temp = resolve(item.src.path);
					if (typeof temp === 'string') {
						item.fmt = { name: temp, args: [] };
					}
				}
			}
		}
	}
	
	/**
	 * Renders template from its name.
	 */
	function render(target: Element = document.body, name: string): void {
		target.childNodes.forEach(item => {
			if (item instanceof HTMLTemplateElement) {
				if (item.id in templates) {
					throw new Error('Duplicated template id: ' + item.id);
				}
				if (name === undefined) {
					name = item.id;
				}
				
				let expr = [];
				
				item.content.childNodes.forEach(child => {
					if (child instanceof Element) {
						expr.push(ExprParser.parseElement(child));
					}
					else if (child instanceof Text) {
						expr.push(...ExprParser.parseText(child.nodeValue));
					}
				});
				
				parseModel(expr);
				
				templates[item.id] = expr;
				
				item.remove();
			}
		});
		
		parseTemplate(name, target, instance.data);
	}
	
	/**
	 * Binds `target.dependencyProperty` to `source.sourceProperty`.
	 * When the source changes, the target's listeners will receive a notification.
	 */
	function depend(target: any, dependencyProperty: string, source: any, sourceProperty?: string | string[]): void {
		if (arguments.length < 4) {
			sourceProperty = source;
			source = target;
		}
		
		let binder = ObjectObserver.notify.bind(undefined, target, dependencyProperty);
		if (Array.isArray(sourceProperty)) {
			sourceProperty.forEach(prop => ObjectObserver.listen(source, prop, binder));
		}
		else {
			ObjectObserver.listen(source, sourceProperty, binder)
		}
	}
	
	/**
	 * Defines a new property for the target object, as well as its dependencies.
	 * Combines the `Object.defineProperty` and the `depend` function.
	 */
	function define(target: any, property: string, descriptor: FunaPropertyDescriptor): void {
		descriptor.configurable = true;
		Object.defineProperty(target, property, descriptor);
		if (descriptor.links) {
			let binder = ObjectObserver.notify.bind(undefined, target, property);
			for (let item of descriptor.links) {
				if (typeof item === 'string') {
					ObjectObserver.listen(target, item, binder);
				}
				else {
					ObjectObserver.listen(item.src, item.prop, binder);
				}
			}
		}
	}
	
	/**
	 * Signal to update all the `target.property` dependencies.
	 */
	function notify(target: any, property: string): void {
		ObjectObserver.notify(target, property);
	}
	
	Object.defineProperties(instance, {
		version: {
			value: RUNTIME.VERSION
		},
		render: {
			value: render
		},
		depend: {
			value: depend
		},
		define: {
			value: define
		},
		notify: {
			value: notify
		},
	});
}
