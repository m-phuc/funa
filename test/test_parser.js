import { ExprParser } from './lib/parser.js';

test('parseText', 'empty string', () => {
	let a = ExprParser.parseText('');
	
	let b = [];
	
	assertEqual(a, b);
});

test('parseText', 'single run', () => {
	let a = ExprParser.parseText('hello');
	
	let b = [
		{ run: 'hello' }
	];
	
	assertEqual(a, b);
});

test('parseText', 'single simple src', () => {
	let a = ExprParser.parseText('{name}');
	
	let b = [
		{ src: { bind: false, prop: 'name', path: ['name'] }, fmt: undefined }
	];
	
	assertEqual(a, b);
});

test('parseText', 'single dynamic src', () => {
	let a = ExprParser.parseText('{$name}');
	
	let b = [
		{ src: { bind: true, prop: 'name', path: ['name'] }, fmt: undefined }
	];
	
	assertEqual(a, b);
});

test('parseText', 'single src with format', () => {
	let a = ExprParser.parseText('{ name:string }');
	
	let b = [
		{ src: { bind: false, prop: 'name', path: ['name'] }, fmt: { name: 'string', args: [] } }
	];
	
	assertEqual(a, b);
});

test('parseText', 'single src with format callback', () => {
	let a = ExprParser.parseText('{ name:string(0.5, `{a(b)c}`, ) }');
	
	let b = [
		{ src: { bind: false, prop: 'name', path: ['name'] }, fmt: { name: 'string', args: [0.5, '{a(b)c}', null] } }
	];
	
	assertEqual(a, b);
});

test('parseText', 'single nested data path src', () => {
	let a = ExprParser.parseText('{a.b.c}');
	
	let b = [
		{ src: { bind: false, prop: 'c', path: ['a', 'b', 'c'] }, fmt: undefined },
	];
	
	assertEqual(a, b);
});

test('parseText', 'one run, one src', () => {
	let a = ExprParser.parseText('hello {name}');
	
	let b = [
		{ run: 'hello ' },
		{ src: { bind: false, prop: 'name', path: ['name'] }, fmt: undefined },
	];
	
	assertEqual(a, b);
});

test('parseText', 'malformed expressions', () => {
	let inputs = [
		'{ name: string }',
		'{ name :string }',
		'{ name : string }',
		
		'{ name:string( }',
		'{ name:string(`) }',
		'{ name:string(1 2) }',
		
		'{ a. b }',
		'{ a .b }',
		'{ a . b }',
	];
	
	assertThrow(() => {
		inputs.forEach(s => ExprParser.parseText(s));
	});
});


test('parseElement', 'an empty div', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a nested div', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div><em>Hello</em> <strong>world</strong></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {},
		attr: [],
		children: [
			{
				tag: 'EM',
				bind: {},
				attr: [],
				children: [
					{ run: 'Hello' }
				],
			},
			{ run: ' ' },
			{
				tag: 'STRONG',
				bind: {},
				attr: [],
				children: [
					{ run: 'world' }
				],
			},
		],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with text interpolation', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div>hello {name}</div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {},
		attr: [],
		children: [
			{ run: 'hello ' },
			{ src: { bind: false, prop: 'name', path: ['name'] }, fmt: undefined },
		],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with attributes', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div class="{name}" .hidden={$hide}></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {},
		attr: [
			{
				prop: false, name: 'class', text: [
					{ src: { bind: false, prop: 'name', path: ['name'] }, fmt: undefined },
				]
			},
			{
				prop: true, name: 'hidden', text: [
					{ src: { bind: true, prop: 'hide', path: ['hide'] }, fmt: undefined },
				]
			},
		],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with data source expression 1', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div :=data></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			src: { bind: false, prop: 'data', path: ['data'] }
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with data source expression 2', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div $=data></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			src: { bind: true, prop: 'data', path: ['data'] }
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with template switching expression', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div #=tpl></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			tpl: { name: 'tpl' }
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with conditional expression 1', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div ?=test></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			if: { not: false, hnd: { name: 'test', args: undefined } }
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with conditional expression 2', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div !=test()></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			if: { not: true, hnd: { name: 'test', args: [] } }
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with data model expression', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div %=model></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			is: { name: 'model' }
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with event handling expression', () => {
	let e = document.createElement('div');
	e.innerHTML = '<div @click=toggle></div>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'DIV',
		bind: {
			on: [
				{ evt: 'click', hnd: { name: 'toggle', args: [] } }
			]
		},
		attr: [],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with two-way binding expression 1', () => {
	let e = document.createElement('div');
	e.innerHTML = '<input type="checkbox" .checked@change={$selected}>';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'INPUT',
		bind: {},
		attr: [
			{
				prop: false, name: 'type', text: [{ run: 'checkbox' }]
			},
			{
				prop: true, name: 'checked', at: {
					evt: 'change',
					src: { bind: true, prop: 'selected', path: ['selected'] },
					fmt: undefined,
					pre: undefined,
					post: undefined,
				}
			},
		],
		children: [],
	};
	
	assertEqual(a, b);
});

test('parseElement', 'a div with two-way binding expression 2', () => {
	let e = document.createElement('div');
	e.innerHTML = '<input type="text" .value@change="{ pre -> $data:format -> post() }">';
	
	let a = ExprParser.parseElement(e.firstElementChild);
	
	let b = {
		tag: 'INPUT',
		bind: {},
		attr: [
			{
				prop: false, name: 'type', text: [{ run: 'text' }]
			},
			{
				prop: true, name: 'value', at: {
					evt: 'change',
					src: { bind: true, prop: 'data', path: ['data'] },
					fmt: { name: 'format', args: [] },
					pre: { name: 'pre', args: [] },
					post: { name: 'post', args: [] },
				},
			},
		],
		children: [],
	};
	
	assertEqual(a, b);
});
