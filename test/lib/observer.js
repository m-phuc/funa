const ObjectObserver = (() => {
    const map = new WeakMap;
    function observe(target, prop) {
        let d;
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
        let getter, setter;
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
    function notify(target, prop) {
        let a = map.get(target);
        if (a) {
            let b = a.get(prop);
            if (b) {
                b.forEach(item => item.call(target));
            }
        }
    }
    function listen(target, prop, callback) {
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
    function remove(target, prop, callback) {
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
    const map = new WeakMap;
    function compare(arr, old) {
        let a = [];
        let b = [];
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
    function notify(target, event, data) {
        let track = map.get(target);
        if (track) {
            track[event].forEach(item => item.call(target, data));
        }
        if (event !== "change") {
            ObjectObserver.notify(target, 'count');
        }
    }
    function listen(target, insert, remove, change) {
        let track = map.get(target);
        if (track) {
            let callback = [insert, remove, change];
            ['insert', 'remove', 'change'].forEach((evt, idx) => {
                track[evt].push(callback[idx]);
            });
        }
    }
    function remove(target, insert, remove, change) {
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
    function observe(target) {
        if (map.has(target)) {
            return;
        }
        function push(...items) {
            let n = target.length;
            let r = Array.prototype.push.apply(target, items);
            if (items.length) {
                notify(target, "insert", {
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
                notify(target, "remove", {
                    index: n - 1,
                    items: [r],
                });
            }
            return r;
        }
        function unshift(...items) {
            let r = Array.prototype.unshift.apply(target, items);
            if (items.length) {
                notify(target, "insert", {
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
                notify(target, "remove", {
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
                notify(target, "change", changed);
            }
            return r;
        }
        function sort(comparefn) {
            let clone = target.slice();
            let r = Array.prototype.sort.apply(target, [comparefn]);
            let changed = compare(target, clone);
            if (changed.length) {
                notify(target, "change", changed);
            }
            return r;
        }
        function splice(start, deleteCount, ...items) {
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
                notify(target, "remove", {
                    index: start,
                    items: r,
                });
            }
            if (items.length) {
                notify(target, "insert", {
                    index: start,
                    items: items,
                });
            }
            return r;
        }
        map.set(target, { insert: [], remove: [], change: [] });
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
export { ObjectObserver, ArrayObserver };
