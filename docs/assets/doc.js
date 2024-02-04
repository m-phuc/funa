import { Highlight } from './highlight.js';
function $(q, e = document.body) {
    return e.querySelector(q);
}
function $$(q, e = document.body) {
    return e.querySelectorAll(q);
}
function play(target, force) {
    let old = $('iframe', target);
    if (old) {
        if (force) {
            old.remove();
        }
        else {
            return;
        }
    }
    let frame = document.createElement('iframe');
    target.appendChild(frame);
    window.setTimeout(() => {
        let doc = frame.contentDocument;
        function inject(tag, content, options) {
            let e = doc.createElement(tag);
            if (options) {
                Object.entries(options).forEach(([key, val]) => e[key] = val);
            }
            e.innerHTML = content;
            doc.head.appendChild(e);
        }
        inject('style', `
@font-face {
	font-family: Inter;
	font-style: normal;
	font-weight: normal;
	src: url("/funa/fonts/Inter-Regular.woff2") format("woff2");
}
@font-face {
	font-family: Inter;
	font-style: normal;
	font-weight: bold;
	src: url("/funa/fonts/Inter-Bold.woff2") format("woff2");
}
* {
	font-family: Inter, sans-serif;
	font-size: 14px;
}
`);
        let { html, css, js } = target.src;
        if (html) {
            doc.body.innerHTML = html;
        }
        if (css) {
            inject('style', css);
        }
        if (js) {
            inject('script', 'import { Funa } from "/funa/assets/funa.js";\n\n' + js, { type: 'module' });
        }
    }, 100);
}
function load() {
    $$('details').forEach(details => {
        details.src = {};
        ['html', 'css', 'js'].forEach(lang => {
            let pre = $('pre.' + lang, details);
            if (pre) {
                details.src[lang] = pre.textContent;
            }
        });
        details.addEventListener('toggle', e => {
            if (details.open) {
                play(details, false);
            }
        });
        let button = document.createElement('button');
        button.textContent = 'Reset';
        button.addEventListener('click', play.bind(undefined, details, true));
        details.insertAdjacentElement('beforeend', button);
    });
    $$('pre').forEach(pre => {
        let lang;
        for (let value of pre.classList.values()) {
            if (value in Highlight.language) {
                lang = value;
                break;
            }
        }
        if (lang) {
            let src = pre.textContent;
            pre.replaceWith(Highlight.parse(lang, src));
        }
    });
}
window.onload = load;
