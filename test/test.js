window.$ = function (q, e = document.body) {
	return e.querySelector(q);
};

window.$$ = function (q, e = document.body) {
	return e.querySelectorAll(q);
};

window.test = function (name, message, callback) {
	let ok;
	try {
		callback();
		ok = true;
	}
	catch (err) {
		ok = false;
		console.error(name + '\n' + err.message);
	}
	
	let p = element('p', { className: ok ? 'success' : 'failure', textContent: name }, document.body);
	if (!ok) {
		element('div', { textContent: message }, p);
	}
};

window.assert = function (expression, message) {
	if (!expression) {
		throw new Error(message);
	}
}

window.assertEqual = function (actual, expected) {
	if (actual === expected) {
		return;
	}
	if (typeof actual === 'object' && actual !== null && typeof expected === 'object' && expected !== null) {
		if (Array.isArray(actual) && Array.isArray(expected)) {
			actual.forEach((x, i) => assertEqual(x, expected[i]));
			return;
		}
		else {
			let a = Object.keys(actual).sort();
			let b = Object.keys(expected).sort();
			if (a.length === b.length) {
				a.forEach((k, i) => assertEqual(actual[k], expected[b[i]]));
				return;
			}
		}
	}
	throw new Error('EqualAssertionError');
}

window.assertJson = function (actual, expected) {
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error('JsonAssertionError');
	}
}

window.assertThrow = function (callback, expected) {
	let err;
	try {
		callback();
	}
	catch (e) {
		err = e;
	}
	if (err) {
		if (!expected || err instanceof expected) {
			return;
		}
	}
	throw new Error('ThrowAssertionError');
}

function element(tag, properties, parent) {
	let e = document.createElement(tag);
	for (let [k, v] of Object.entries(properties)) {
		if (k[0] === '$') {
			e.addEventListener(k.substring(1), v);
		}
		else {
			e[k] = v;
		}
	}
	parent.appendChild(e);
	return e;
}

function load() {
	/** @type {HTMLSelectElement} */
	const select = $('select');
	
	/** @type {HTMLButtonElement} */
	const button = $('button');
	
	button.addEventListener('click', async () => {
		if (select.selectedIndex < 0) {
			return;
		}
		sessionStorage.setItem('test', select.value);
		location.reload();
	});
	
	const suites = [
		'parser',
		'observer',
		'core',
	];
	
	for (let item of suites) {
		element('option', { textContent: item }, select);
	}
	
	select.selectedIndex = suites.indexOf(sessionStorage.getItem('test'));
	
	if (select.selectedIndex >= 0) {
		let file = select.value;
		select.selectedIndex = -1;
		sessionStorage.removeItem('test');
		import(`./test_${file}.js`);
	}
}

load();