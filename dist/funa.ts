const enum RUNTIME {
	VERSION = 1.0
}

type FunaAs<T, U> = {
	convert?: (value: T, ...args: (string | number)[]) => U;
	revert?: (value: U, ...args: (string | number)[]) => T;
}

type FunaIf = (...args: (string | number)[]) => boolean

type FunaIs = {
	[key: string]: (string | FunaIs)
}

type FunaOn = (sender: Element, event: Event, ...args: (string | number)[]) => void

interface FunaConfig {
	bypassTags: string[];
}

interface FunaInit {
	config?: FunaConfig;
	data?: Record<string, any>;
	as?: Record<string, FunaAs<any, any>>;
	if?: Record<string, FunaIf>;
	is?: Record<string, FunaIs>;
	on?: Record<string, FunaOn>;
}

interface FunaPropertyDescriptor extends PropertyDescriptor {
	links: (string | { src: any, prop: string })[];
}

declare class Funa<T extends FunaInit> {
	constructor(init?: T);
	
	version: number;
	
	data: Record<string, any> & T['data'];
	as: Record<string, FunaAs<any, any>> & T['as'];
	if: Record<string, FunaIf> & T['if'];
	is: Record<string, FunaIs> & T['is'];
	on: Record<string, FunaOn> & T['on'];
	
	render: (target?: Element, name?: string) => void;
	
	depend(target: any, dependencyProperty: string, sourceProperty: string | string[]): void;
	depend(target: any, dependencyProperty: string, source: any, sourceProperty: string | string[]): void;
	
	define(target: any, property: string, descriptor: FunaPropertyDescriptor): void;
	
	notify(target: any, property: string): void;
}

function Funa<T extends FunaInit>(this: Funa<T>, init?: FunaInit) {
	if (!new.target) {
		throw new Error('Funa() must be called with new');
	}
	
	const instance = this;

interface FnExpr {
	name: string;
	args?: (string | number)[];
}

interface SrcExpr {
	bind: boolean;
	prop: string;
	path: string[];
}

interface TplExpr {
	name: string;
}

interface IfExpr {
	not: boolean;
	hnd: FnExpr;
}

interface IsExpr {
	name: string;
}

interface OnExpr {
	evt: string;
	hnd: FnExpr;
}

interface BindExpr {
	src?: SrcExpr;
	tpl?: TplExpr;
	if?: IfExpr;
	is?: IsExpr;
	on?: OnExpr[];
}

interface TextExpr {
	run?: string;
	src?: SrcExpr;
	fmt?: FnExpr;
}

interface AtExpr {
	evt: string;
	src: SrcExpr;
	fmt?: FnExpr;
	pre?: FnExpr;
	post?: FnExpr;
}

interface AttrExpr {
	prop: boolean;
	name: string;
	text?: TextExpr[];
	at?: AtExpr;
}

interface NodeExpr {
	tag: string;
	bind: BindExpr;
	attr: AttrExpr[];
	children: (Node | NodeExpr | TextExpr)[];
}

const ExprParser = (() => {
	/**
	 * List of tags bypassed during parsing.
	 */
	let bypass: string[] = [];
	
	/**
	 * Splits text into literals and expressions, delimited by {braces}.
	 */
	function parseText(input: string): string[] {
		// The expressions can contain backtick quoted strings.
		return input.split(/\{\s*((?:`.*`|.)*?)\s*\}/g);
	}
	
	/**
	 * Transpiles expression into tokens, represented as symbols for later pattern matching.
	 */
	function parseExpr<T>(input: string, test: (value: string, tokens: (string | FnExpr)[]) => T): T {
		let mem = <(string | number)[]>[];  // Temporary array to hold the actual values
		let tok = <(string | FnExpr)[]>[];  // Token array after parsing
		let err = false;
		
		// Represents quoted strings and numbers as "A",
		// identifiers (with dot notation) as "I".
		let src = input.replace(/`([^`]*)`|(-?\d+(?:\.\d+)?)|([\w\.]+)/g, (m: string, p1: string, p2: string, p3: string) => {
			if (p1 != undefined) {
				return 'A' + (mem.push(p1) - 1);
			}
			else if (p2 != undefined) {
				return 'A' + (mem.push(parseFloat(p2)) - 1);
			}
			else if (p3 != undefined) {
				return 'I' + (mem.push(p3) - 1);
			}
		});
		
		// Removes spaces around parentheses, comma and arrow.
		src = src.replace(/\s*(?=\(|\)|,|->)|(?<=\(|\)|,|->)\s*/g, '');
		
		// Represents function (with arguments) as "F",
		// "I" symbols as "T".
		src = src.replace(/I(\d+)(?:\(([^)]*)\))?/g, (m: string, p1: number, p2: string) => {
			let word = <string>mem[p1];
			if (p2 != undefined) {
				let args = <(string | number)[]>[];
				let func = <FnExpr>{ name: word, args: args };
				if (p2 = p2.trim()) {
					for (let s of p2.split(',')) {
						// Only quoted strings and numbers are accepted as valid arguments.
						// However, leaving them empty will be treated as NULL.
						if (s) {
							let m = s.match(/^A(\d+)$/);
							if (m) {
								args.push(mem[m[1]]);
							}
							else {
								err = true;
							}
						}
						else {
							args.push(null);
						}
					}
				}
				return 'F' + (tok.push(func) - 1);
			}
			else {
				return 'T' + (tok.push(word) - 1);
			}
		});
		
		// Expects the callback function to return a fully parsed expression on success,
		// or a falsey on error.
		if (!err) {
			let expr = test(src, tok);
			if (expr) {
				return expr;
			}
		}
		
		// The expression is malformed or does not satisfy the testing pattern.
		throw 'Syntax error: ' + input;
	}
	
	/**
	 * Converts kebab-case to camelCase.
	 */
	function kebabToCamel(input: string): string {
		return input.replace(/-./g, (m) => m[1].toUpperCase());
	}
	
	/**
	 * Converts token to FnExpr.
	 */
	function tokenToFn(tok: string | FnExpr, test: string, func: string, text: string, args?: any): FnExpr {
		// This function is intended for quickly obtaining a FnExpr from a token that was generated by the `parseExpr` function.
		// If the provided token is already a FnExpr, simply take it.
		// Otherwise, it's just the name, so create a new FnExpr for it.
		if (test === func) {
			return <FnExpr>tok;
		}
		else if (test === text) {
			return { name: <string>tok, args: (arguments.length === 5) ? args : [] };
		}
	}
	
	/**
	 * Creates data source expression.
	 */
	function srcExpr(k: string, v: string): SrcExpr {
		// If `v` is empty, then the expression was written in the name of the attribute.
		// Applies case conversion for it.
		if (!v) {
			v = kebabToCamel(k.substring(1));
		}
		let a = v.split('.');
		return {
			bind: (k[0] === '$'),
			prop: a[a.length - 1],
			path: a,
		};
	}
	
	/**
	 * Creates template switching expression.
	 */
	function tplExpr(k: string, v: string): TplExpr {
		return {
			name: v,
		};
	}
	
	/**
	 * Creates conditional rendering expression.
	 */
	function ifExpr(k: string, v: string): IfExpr {
		let hnd = parseExpr(v, (test, toks) => tokenToFn(toks[0], test, 'F0', 'T0', undefined));
		
		return {
			not: (k === '!'),
			hnd: hnd,
		};
	}
	
	/**
	 * Creates data modeling expression.
	 */
	function isExpr(k: string, v: string): IsExpr {
		return {
			name: v,
		};
	}
	
	/**
	 * Creates event handling expression.
	 */
	function onExpr(k: string, v: string): OnExpr {
		let hnd = parseExpr(v, (test, toks) => tokenToFn(toks[0], test, 'F0', 'T0'));
		
		return {
			evt: kebabToCamel(k.substring(1)),
			hnd: hnd,
		};
	}
	
	/**
	 * Creates two-way binding expression.
	 */
	function atExpr(k: string, v: string): AtExpr {
		// There must be no literals in the attribute value.
		let a = parseText(v);
		if (a.length !== 3 || a[0] || a[2]) {
			throw 'Syntax error: ' + v;
		}
		
		return parseExpr(a[1], (test, toks) => {
			let m = test.match(/^(?:(F|T)(\d+)->)?(?:\$T(\d+)(?:\:(F|T)(\d+))?)(?:->(F|T)(\d+))?$/);
			if (m) {
				return <AtExpr>{
					evt: kebabToCamel(k.substring(1)),
					src: srcExpr('$', toks[m[3]]),
					fmt: m[4] ? tokenToFn(toks[m[5]], m[4], 'F', 'T') : undefined,
					pre: m[1] ? tokenToFn(toks[m[2]], m[1], 'F', 'T') : undefined,
					post: m[6] ? tokenToFn(toks[m[7]], m[6], 'F', 'T') : undefined,
				};
			}
		});
	}
	
	/**
	 * Creates text expression.
	 */
	function textExpr(v: string): TextExpr[] {
		let a: TextExpr[] = [];
		
		parseText(v).forEach((s, i) => {
			if (i % 2) {
				if (s === '?') {
					a.push({
						src: srcExpr(':', '?'),
						fmt: undefined,
					});
				}
				else {
					a.push(parseExpr(s, (test, toks) => {
						let m = test.match(/^(\$)?T0(:F1|:T1)?$/);
						if (m) {
							return <TextExpr>{
								src: srcExpr(m[1] || ':', <string>toks[0]),
								fmt: tokenToFn(toks[1], m[2], ':F1', ':T1'),
							};
						}
					}));
				}
			}
			else if (s) {
				a.push({
					run: s
				});
			}
		});
		
		return a;
	}
	
	/**
	 * Creates attribute expression.
	 */
	function attrExpr(k: string, v: string): AttrExpr {
		let prop = (k[0] === '.');
		let i = k.indexOf('@');
		if (i > -1) {
			return {
				prop: prop,
				name: k.substring(prop ? 1 : 0, i),
				at: atExpr(k.substring(i), v),
			};
		}
		else {
			return {
				prop: prop,
				name: prop ? k.substring(1) : k,
				text: textExpr(v),
			};
		}
	}
	
	/**
	 * Parses out decorated HTML element into declarative expressions.
	 */
	function parseElement(node: Element): Node | NodeExpr {
		// Element with tag name in `bypass` list will be leave as is.
		if (bypass.includes(node.tagName)) {
			return node;
		}
		
		let bind: BindExpr = {};
		let attr: AttrExpr[] = [];
		let children: (Node | TextExpr | NodeExpr)[] = [];
		
		for (let item of Array.from(node.attributes)) {
			let c = item.name[0];
			let k = item.name;
			let v = item.value;
			
			if (c === ':' || c === '$') {
				bind.src = srcExpr(k, v);
			}
			else if (k === '#') {
				bind.tpl = tplExpr(k, v);
			}
			else if (k === '?' || k === '!') {
				bind.if = ifExpr(k, v);
			}
			else if (k === '%') {
				bind.is = isExpr(k, v);
			}
			else if (c === '@') {
				if (!bind.on) {
					bind.on = [];
				}
				bind.on.push(onExpr(k, v));
			}
			else {
				attr.push(attrExpr(item.name, v));
			}
		}
		
		for (let item of node.childNodes) {
			if (item instanceof Element) {
				children.push(parseElement(item));
			}
			else if (item instanceof Text) {
				children.push(...textExpr(item.nodeValue));
			}
		}
		
		return {
			tag: node.tagName,
			bind: bind,
			attr: attr,
			children: children,
		};
	}
	
	
	return {
		set bypass(value: string[]) {
			bypass = value;
		},
		
		parseElement: parseElement,
		
		parseText: textExpr,
	};
})();

const enum ArrayNotify {
	Insert = 'insert',
	Remove = 'remove',
	Change = 'change',
}

interface ArrayTrack {
	insert: Function[];
	remove: Function[];
	change: Function[];
}

interface ArrayInsert {
	index: number;
	items: any[];
}

interface ArrayRemove {
	index: number;
	items: any[];
}

interface ArrayChange {
	before: number;
	after: number;
}

const ObjectObserver = (() => {
	/**
	 * Stores the observed objects and their handlers.
	 */
	const map: WeakMap<any, Map<string, Function[]>> = new WeakMap;
	
	/**
	 * Observes the `target.prop` for changes. Whenever it changes, invokes the `notify` function.
	 */
	function observe(target: any, prop: string): void {
		let d: PropertyDescriptor;
		if (typeof target === 'object') {
			d = Object.getOwnPropertyDescriptor(target, prop);
		}
		if (!d || !d.configurable) {
			throw {
				message: 'Target is not observable',
				object: target,
				property: prop,
			};
		}
		
		let getter: () => any, setter: (value: any) => void;
		
		if (d.hasOwnProperty('value')) {
			let v = target[prop];
			
			getter = () => v;
			
			setter = (value) => {
				v = value;
				notify(target, prop);
			};
		}
		else {
			getter = d.get;
			
			if (d.set) {
				setter = (value) => {
					d.set.call(target, value);
					notify(target, prop);
				};
			}
		}
		
		Object.defineProperty(target, prop, {
			configurable: true,
			enumerable: d.enumerable,
			get: getter,
			set: setter,
		});
	}
	
	/**
	 * Notifies the changes to all the listeners that are listening to the `target.prop`.
	 */
	function notify(target: any, prop: string): void {
		let a = map.get(target);
		if (a) {
			let b = a.get(prop);
			if (b) {
				b.forEach(item => item.call(target));
			}
		}
	}
	
	/**
	 * Adds a listener to the `target.prop`. Whenever it changes, invokes the `callback` function.
	 */
	function listen(target: any, prop: string, callback: Function): void {
		let a = map.get(target);
		if (!a) {
			a = new Map;
			map.set(target, a);
		}
		
		let b = a.get(prop);
		if (!b) {
			b = [];
			a.set(prop, b);
			observe(target, prop);
		}
		
		b.unshift(callback);
	}
	
	/**
	 * Removes the `callback` function from the listeners of the `target.prop`.
	 */
	function remove(target: any, prop: string, callback: Function): void {
		let a = map.get(target);
		if (!a) {
			return;
		}
		
		let b = a.get(prop);
		if (!b) {
			return;
		}
		
		let k = b.indexOf(callback);
		if (k > -1) {
			b.splice(k, 1);
		}
	}
	
	
	return {
		notify: notify,
		listen: listen,
		remove: remove,
	};
})();

const ArrayObserver = (() => {
	/**
	 * Stores the observed arrays and their handlers.
	 */
	const map: WeakMap<any[], ArrayTrack> = new WeakMap;
	
	/**
	 * Compares the elements of the array with its old, to find out which elements that have been swapped.
	 */
	function compare(arr: any[], old: any[]): ArrayChange[] {
		let a: number[] = [];
		let b: ArrayChange[] = [];
		for (let i = 0, n = arr.length; i < n; i++) {
			let k = -1;
			do {
				k = old.indexOf(arr[i], k + 1);
			} while (a.includes(k));
			a.push(k);
			if (k !== i) {
				b.push({ before: k, after: i });
			}
		}
		return b;
	}
	
	/**
	 * Notifies the changes to all the listeners that are listening to the array.
	 */
	function notify(target: any[], event: ArrayNotify, data: ArrayInsert | ArrayRemove | ArrayChange[]): void {
		let track = map.get(target);
		if (track) {
			track[event].forEach(item => item.call(target, data));
		}
		if (event !== ArrayNotify.Change) {
			ObjectObserver.notify(target, 'count');
		}
	}
	
	/**
	 * Adds a listener to the array. Whenever it changes, invokes the corresponding callback functions.
	 */
	function listen(target: any[], insert: Function, remove: Function, change: Function): void {
		let track = map.get(target);
		if (track) {
			let callback = [insert, remove, change];
			['insert', 'remove', 'change'].forEach((evt, idx) => {
				track[evt].push(callback[idx]);
			});
		}
	}
	
	/**
	 * Removes the callback functions from the listeners of the array.
	 */
	function remove(target: any[], insert: Function, remove: Function, change: Function): void {
		let track = map.get(target);
		if (track) {
			let callback = [insert, remove, change];
			['insert', 'remove', 'change'].forEach((evt, idx) => {
				let k = track[evt].indexOf(callback[idx]);
				if (k > -1) {
					track[evt].splice(k, 1);
				}
			});
		}
	}
	
	/**
	 * Observes the array for changes. Whenever it changes, invokes the `notify` function.
	 */
	function observe(target: any[]): void {
		if (map.has(target)) {
			return;
		}
		
		function push(...items: any[]) {
			let n = target.length;
			let r = Array.prototype.push.apply(target, items);
			if (items.length) {
				notify(target, ArrayNotify.Insert, <ArrayInsert>{
					index: n,
					items: items,
				});
			}
			return r;
		}
		
		function pop() {
			let n = target.length;
			let r = Array.prototype.pop.apply(target);
			if (n) {
				notify(target, ArrayNotify.Remove, <ArrayRemove>{
					index: n - 1,
					items: [r],
				});
			}
			return r;
		}
		
		function unshift(...items: any[]) {
			let r = Array.prototype.unshift.apply(target, items);
			if (items.length) {
				notify(target, ArrayNotify.Insert, <ArrayInsert>{
					index: 0,
					items: items,
				});
			}
			return r;
		}
		
		function shift() {
			let n = target.length;
			let r = Array.prototype.shift.apply(target);
			if (n) {
				notify(target, ArrayNotify.Remove, <ArrayRemove>{
					index: 0,
					items: [r],
				});
			}
			return r;
		}
		
		function reverse() {
			let clone = target.slice();
			let r = Array.prototype.reverse.apply(target);
			let changed = compare(target, clone);
			if (changed.length) {
				notify(target, ArrayNotify.Change, changed);
			}
			return r;
		}
		
		function sort(comparefn?: (x: any, y: any) => number) {
			let clone = target.slice();
			let r = Array.prototype.sort.apply(target, [comparefn]);
			let changed = compare(target, clone);
			if (changed.length) {
				notify(target, ArrayNotify.Change, changed);
			}
			return r;
		}
		
		function splice(start: number, deleteCount: number, ...items: any[]) {
			let n = target.length;
			if (start === Number.NEGATIVE_INFINITY) {
				start = 0;
			}
			else if (start < 0) {
				start = Math.max(n + start, 0);
			}
			else {
				start = Math.min(start, n);
			}
			
			let len = arguments.length;
			let args = (len === 0) ? [] : (len === 1) ? [start] : [start, deleteCount, ...items];
			
			let r = Array.prototype.splice.apply(target, args);
			if (r.length) {
				notify(target, ArrayNotify.Remove, <ArrayRemove>{
					index: start,
					items: r,
				});
			}
			if (items.length) {
				notify(target, ArrayNotify.Insert, <ArrayInsert>{
					index: start,
					items: items,
				});
			}
			return r;
		}
		
		map.set(target, {insert: [], remove: [], change: []});
		
		Object.defineProperties(target, {
			push: { value: push },
			pop: { value: pop },
			unshift: { value: unshift },
			shift: { value: shift },
			reverse: { value: reverse },
			sort: { value: sort },
			splice: { value: splice },
			count: {
				configurable: true,
				enumerable: false,
				get() {
					return target.length;
				},
			},
		});
	}
	
	
	return {
		observe: observe,
		listen: listen,
		remove: remove,
	};
})();

	
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

export { Funa };

//#