import { Funa } from './lib/funa.js';

const parser = new DOMParser;

test('render', 'bypass tags', () => {
	const html = `
<body>
<template>
	<p $="a"><span>{b}</span></p>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		config: {
			bypassTags: ['p']
		}
	});
	
	app.render(doc.body);
	
	assertEqual($('p', doc).outerHTML, '<p $="a"><span>{b}</span></p>');
});

test('render', 'text interpolation', () => {
	const html = `
<body>
<template>
	<main>
		<p id="p1" class={$a}>{$x}</p>
		<p id="p2" class={$b.c}>-{$y.z}</p>
	</main>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: 'A',
			b: { c: 'B' },
			x: 1,
			y: { z: 2 },
		}
	});
	
	app.render(doc.body);
	
	const p1 = $('#p1', doc);
	const p2 = $('#p2', doc);
	
	assertEqual(p1.className, 'A');
	assertEqual(p2.className, 'B');
	assertEqual(p1.textContent, '1');
	assertEqual(p2.textContent, '-2');
	
	app.data.a = undefined;
	app.data.b.c = 'C';
	app.data.x = null;
	app.data.y = { z: 3 };
	
	assertEqual(p1.className, '');
	assertEqual(p2.className, 'C');
	assertEqual(p1.textContent, '');
	assertEqual(p2.textContent, '-3');
});

test('render', 'custom formatting', () => {
	const html = `
<body>
<template>
	<p>{a:b}</p>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: 1
		},
		
		as: {
			b: {
				convert: (value) => '0' + value
			}
		},
	});
	
	app.render(doc.body);
	
	assertEqual($('p', doc).textContent, '01');
});

test('render', 'data source', () => {
	const html = `
<body>
<template>
	<main>
		<p id="p1" :=a.b.c>{d}</p>
		<p id="p2" $=a.b.c>{d}</p>
	</main>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: {
				b: {
					c: {
						d: 1
					}
				}
			}
		},
	});
	
	app.render(doc.body);
	
	assertEqual($('#p1', doc).textContent, '1');
	assertEqual($('#p2', doc).textContent, '1');
	
	app.data.a.b.c = { d: 2 };
	assertEqual($('#p2', doc).textContent, '2');
	
	app.data.a.b = { c: { d: 3 } };
	assertEqual($('#p2', doc).textContent, '3');
	
	app.data.a = { b: { c: { d: 4 } } };
	assertEqual($('#p2', doc).textContent, '4');
	
	assertEqual($('#p1', doc).textContent, '1');
});

test('render', 'conditional', () => {
	const html = `
<body>
<template>
	<main>
		<p id="p1" ?=a></p>
		<p id="p2" !=b></p>
		<p id="p2" ?=c()></p>
		<p id="p4" !=d(0)></p>
		<p id="p5" ?=e.f></p>
	</main>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: true,
			b: 1,
			e: {
				f: 2
			}
		},
		
		if: {
			c: () => false,
			d: (arg) => arg,
		},
	});
	
	app.render(doc.body);
	
	assertEqual($$('#p1', doc).length, 1);
	assertEqual($$('#p2', doc).length, 0);
	assertEqual($$('#p3', doc).length, 0);
	assertEqual($$('#p4', doc).length, 1);
	assertEqual($$('#p5', doc).length, 1);
});

test('render', 'template switching', () => {
	const html = `
<body>
<template>
	<p id="p1" #=tplA></p>
</template>
<template id="tplA">
	<p id="p2" #=tplB></p>
</template>
<template id="tplB">
	<p id="p3"></p>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa;
	
	app.render(doc.body);
	
	assertEqual($$('#p1', doc).length, 0);
	assertEqual($$('#p2', doc).length, 0);
	assertEqual($$('#p3', doc).length, 1);
});

test('render', 'event handling', () => {
	const html = `
<body>
<template>
	<main @=inc>
		<p>{$count}</p>
		<button @click=inc(10)>Click me</button>
	</main>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			count: 0
		},
		
		on: {
			inc: (sender, e, times = 1) => app.data.count += times
		},
	});
	
	app.render(doc.body);
	
	$('button', doc).click();
	
	assertEqual($('p', doc).textContent, '11');
});

test('render', 'two-way binding', () => {
	const html = `
<body>
<template>
	<main>
		<input type="checkbox" .checked@change="{inc(1) -> $selected -> inc(2)}">
	</main>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	let k = 0;
	
	const app = new Funa({
		data: {
			selected: false
		},
		
		on: {
			inc: (sender, e, arg) => k += arg
		},
	});
	
	app.render(doc.body);
	
	$('input', doc).click();
	
	assertEqual(app.data.selected, true);
	assertEqual(k, 3);
});

test('render', 'array rendering 1', () => {
	const html = `
<body>
<template>
	<ul $=list>
		<li>{?}</li>
	</ul>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			list: ['A', 'B', 'C']
		}
	});
	
	app.render(doc.body);
	
	assertEqual($('ul', doc).children.length, 3);
	
	app.data.list.push('D', 'E');
	
	assertEqual($('ul', doc).children.length, 5);
	assertEqual($('ul', doc).lastElementChild.textContent, 'E');
	
	app.data.list.splice(0);
	
	assertEqual($('ul', doc).children.length, 0);
});

test('render', 'array rendering 2', () => {
	const html = `
<body>
<template>
	<ul $=list>
		<li>{name}</li>
	</ul>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			list: [
				{ name: 'A' },
				{ name: 'B' },
				{ name: 'C' },
			]
		}
	});
	
	app.render(doc.body);
	
	assertEqual($('ul', doc).children.length, 3);
	
	app.data.list.push(
		{ name: 'D' },
		{ name: 'E' },
	);
	
	assertEqual($('ul', doc).children.length, 5);
	assertEqual($('ul', doc).lastElementChild.textContent, 'E');
	
	app.data.list.splice(0);
	
	assertEqual($('ul', doc).children.length, 0);
});

test('render', 'data model', () => {
	const html = `
<body>
<template>
	<div :a %=a>
		<div :b>
			<p id="p1">{x}</p>
			<p id="p2">{x:float}</p>
		</div>
	</div>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: {
				b: {
					x: 1234
				}
			}
		},
		
		as: {
			int: {
				convert: (value) => value.toLocaleString()
			},

			float: {
				convert: (value) => value.toLocaleString('en', { minimumFractionDigits: 2 })
			},
		},
		
		is: {
			a: {
				b: {
					x: 'int'
				}
			}
		},
	});
	
	app.render(doc.body);
	
	assertEqual($('#p1', doc).textContent, '1,234');
	assertEqual($('#p2', doc).textContent, '1,234.00');
});

test('render', 'depend', () => {
	const html = `
<body>
<template>
	<p>{$total}</p>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: 1,
			
			b: 2,
			
			get total() {
				return this.a + this.b;
			}
		}
	});
	
	app.render(doc.body);
	
	app.depend(app.data, 'total', ['a', 'b']);
	
	assertEqual($('p', doc).textContent, '3');
	
	app.data.a = 3;
	assertEqual($('p', doc).textContent, '5');
	
	app.data.b = 4;
	assertEqual($('p', doc).textContent, '7');
});

test('render', 'define', () => {
	const html = `
<body>
<template>
	<p>{$total}</p>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	const app = new Funa({
		data: {
			a: 1,
			b: 2,
		}
	});
	
	app.define(app.data, 'total', {
		get() {
			return this.a + this.b;
		},
		
		links: ['a', {src: app.data, prop: 'b'}],
	});
	
	app.render(doc.body);
	
	assertEqual($('p', doc).textContent, '3');
	
	app.data.a = 3;
	assertEqual($('p', doc).textContent, '5');
	
	app.data.b = 4;
	assertEqual($('p', doc).textContent, '7');
});

test('render', 'notify', () => {
	const html = `
<body>
<template>
	<p>{$total}</p>
</template>
</body>
`;
	
	const doc = parser.parseFromString(html, 'text/html');
	
	let n = 0;
	
	const app = new Funa({
		data: {
			get total() {
				return n;
			}
		}
	});
	
	app.render(doc.body);
	
	n = 1;
	assertEqual($('p', doc).textContent, '0');
	app.notify(app.data, 'total');
	assertEqual($('p', doc).textContent, '1');
});
