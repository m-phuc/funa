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
