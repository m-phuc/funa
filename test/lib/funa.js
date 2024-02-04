function Funa(init) {
    if (!new.target) {
        throw new Error('Funa() must be called with new');
    }
    const instance = this;
    const ExprParser = (() => {
        let bypass = [];
        function parseText(input) {
            return input.split(/\{\s*((?:`.*`|.)*?)\s*\}/g);
        }
        function parseExpr(input, test) {
            let mem = [];
            let tok = [];
            let err = false;
            let src = input.replace(/`([^`]*)`|(-?\d+(?:\.\d+)?)|([\w\.]+)/g, (m, p1, p2, p3) => {
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
            src = src.replace(/\s*(?=\(|\)|,|->)|(?<=\(|\)|,|->)\s*/g, '');
            src = src.replace(/I(\d+)(?:\(([^)]*)\))?/g, (m, p1, p2) => {
                let word = mem[p1];
                if (p2 != undefined) {
                    let args = [];
                    let func = { name: word, args: args };
                    if (p2 = p2.trim()) {
                        for (let s of p2.split(',')) {
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
            if (!err) {
                let expr = test(src, tok);
                if (expr) {
                    return expr;
                }
            }
            throw 'Syntax error: ' + input;
        }
        function kebabToCamel(input) {
            return input.replace(/-./g, (m) => m[1].toUpperCase());
        }
        function tokenToFn(tok, test, func, text, args) {
            if (test === func) {
                return tok;
            }
            else if (test === text) {
                return { name: tok, args: (arguments.length === 5) ? args : [] };
            }
        }
        function srcExpr(k, v) {
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
        function tplExpr(k, v) {
            return {
                name: v,
            };
        }
        function ifExpr(k, v) {
            let hnd = parseExpr(v, (test, toks) => tokenToFn(toks[0], test, 'F0', 'T0', undefined));
            return {
                not: (k === '!'),
                hnd: hnd,
            };
        }
        function isExpr(k, v) {
            return {
                name: v,
            };
        }
        function onExpr(k, v) {
            let hnd = parseExpr(v, (test, toks) => tokenToFn(toks[0], test, 'F0', 'T0'));
            return {
                evt: kebabToCamel(k.substring(1)),
                hnd: hnd,
            };
        }
        function atExpr(k, v) {
            let a = parseText(v);
            if (a.length !== 3 || a[0] || a[2]) {
                throw 'Syntax error: ' + v;
            }
            return parseExpr(a[1], (test, toks) => {
                let m = test.match(/^(?:(F|T)(\d+)->)?(?:\$T(\d+)(?:\:(F|T)(\d+))?)(?:->(F|T)(\d+))?$/);
                if (m) {
                    return {
                        evt: kebabToCamel(k.substring(1)),
                        src: srcExpr('$', toks[m[3]]),
                        fmt: m[4] ? tokenToFn(toks[m[5]], m[4], 'F', 'T') : undefined,
                        pre: m[1] ? tokenToFn(toks[m[2]], m[1], 'F', 'T') : undefined,
                        post: m[6] ? tokenToFn(toks[m[7]], m[6], 'F', 'T') : undefined,
                    };
                }
            });
        }
        function textExpr(v) {
            let a = [];
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
                                return {
                                    src: srcExpr(m[1] || ':', toks[0]),
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
        function attrExpr(k, v) {
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
        function parseElement(node) {
            if (bypass.includes(node.tagName)) {
                return node;
            }
            let bind = {};
            let attr = [];
            let children = [];
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
            set bypass(value) {
                bypass = value;
            },
            parseElement: parseElement,
            parseText: textExpr,
        };
    })();
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
    if (!init) {
        init = {};
    }
    ExprParser.bypass = ['TEMPLATE', 'PRE', 'CODE', ...(init.config?.bypassTags || []).map(tag => tag.toUpperCase())];
    ['data', 'as', 'if', 'is', 'on'].forEach(field => Object.defineProperty(instance, field, {
        value: init[field] || {}
    }));
    const templates = {};
    const watchdom = new WeakMap;
    function getHandler(dict, fn) {
        let name = fn.name;
        if (!(name in dict)) {
            throw new Error('Callback is not defined: ' + name);
        }
        return dict[name];
    }
    function deepWatch(data, path, callback) {
        let maps = [];
        function observe(k) {
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
    function unWatch(child, remove = false) {
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
    function parseData(data, path) {
        for (let prop of path) {
            if (data != undefined) {
                data = data[prop];
            }
        }
        return data;
    }
    function parseRun(text, data) {
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
    function parseText(text, target, data, append) {
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
    function parseBind(attr, target, data) {
        let name = attr.name;
        let at = attr.at;
        let src = at.src;
        let fmt;
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
        function run() {
            let s = parseRun(at, data);
            attr.prop ? target[name] = s : target.setAttribute(name, s);
        }
        run();
        watchdom.set(target, [deepWatch(data, src.path, run)]);
    }
    function parseAttr(attr, target, data) {
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
    function parseArray(node, target, data) {
        const map = [];
        function insert(event) {
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
        function remove(event) {
            map.splice(event.index, event.items.length).forEach(arr => arr.forEach(item => unWatch(item, true)));
        }
        function change(event) {
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
    function parseElement(node, target, data, append) {
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
            let test = Boolean(hnd.args ?
                getHandler(instance.if, hnd).call(data, ...hnd.args) :
                parseData(data, hnd.name.split('.')));
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
            let defer;
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
    function parseNode(child, target, data, append = true) {
        let e;
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
    function parseTemplate(name, target, data) {
        for (let child of templates[name]) {
            parseNode(child, target, data);
        }
    }
    function parseModel(expr, model) {
        function resolve(path) {
            let temp = model;
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
    function render(target = document.body, name) {
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
    function depend(target, dependencyProperty, source, sourceProperty) {
        if (arguments.length < 4) {
            sourceProperty = source;
            source = target;
        }
        let binder = ObjectObserver.notify.bind(undefined, target, dependencyProperty);
        if (Array.isArray(sourceProperty)) {
            sourceProperty.forEach(prop => ObjectObserver.listen(source, prop, binder));
        }
        else {
            ObjectObserver.listen(source, sourceProperty, binder);
        }
    }
    function define(target, property, descriptor) {
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
    function notify(target, property) {
        ObjectObserver.notify(target, property);
    }
    Object.defineProperties(instance, {
        version: {
            value: 1
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
