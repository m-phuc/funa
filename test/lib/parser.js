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
export { ExprParser };
