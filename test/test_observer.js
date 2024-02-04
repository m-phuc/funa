import { ObjectObserver, ArrayObserver } from './lib/observer.js';

test('ObjectObserver', 'listen', () => {
	let a = { x: 1 };
	let b;
	
	ObjectObserver.listen(a, 'x', function () {
		b = this.x;
	});
	
	a.x = 2;
	
	assertEqual(b, 2);
});

test('ObjectObserver', 'notify', () => {
	let a = { x: 1 };
	let b;
	
	ObjectObserver.listen(a, 'x', function () {
		b = this.x;
	});
	
	ObjectObserver.notify(a, 'x');
	
	assertEqual(b, 1);
});

test('ObjectObserver', 'remove', () => {
	let a = { x: 1 };
	let b;
	let f = function () {
		b = this.x;
	};
	
	ObjectObserver.listen(a, 'x', f);
	
	a.x = 2;
	
	ObjectObserver.remove(a, 'x', f);
	
	a.x = 3;
	
	assertEqual(b, 2);
});


test('ArrayObserver', 'push', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.push(4, 5);
	
	assertEqual(a, [1, 3, 2, 4, 5]);
	assertEqual(b, 5);
});

test('ArrayObserver', 'pop', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.pop();
	
	assertEqual(a, [1, 3]);
	assertEqual(b, 2);
});

test('ArrayObserver', 'unshift', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.unshift(4, 5);
	
	assertEqual(a, [4, 5, 1, 3, 2]);
	assertEqual(b, 5);
});

test('ArrayObserver', 'shift', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.shift();
	
	assertEqual(a, [3, 2]);
	assertEqual(b, 1);
});

test('ArrayObserver', 'reverse', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.reverse();
	
	assertEqual(a, [2, 3, 1]);
	assertEqual(a, b);
});

test('ArrayObserver', 'sort', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.sort();
	
	assertEqual(a, [1, 2, 3]);
	assertEqual(a, b);
});

test('ArrayObserver', 'splice', () => {
	let a = [1, 3, 2];
	
	ArrayObserver.observe(a);
	
	let b = a.splice(Number.NEGATIVE_INFINITY, undefined, 4);
	assertEqual(a, [4, 1, 3, 2]);
	assertEqual(b, []);
	
	let c = a.splice(-1, 0, 5);
	assertEqual(a, [4, 1, 3, 5, 2]);
	assertEqual(c, []);
	
	let d = a.splice(a.length, 1, 6);
	assertEqual(a, [4, 1, 3, 5, 2, 6]);
	assertEqual(d, []);
	
	let e = a.splice(1, 2, 7, 8, 9);
	assertEqual(a, [4, 7, 8, 9, 5, 2, 6]);
	assertEqual(e, [1, 3]);
	
	let f = a.splice(0);
	assertEqual(a, []);
	assertEqual(f, [4, 7, 8, 9, 5, 2, 6]);
});

test('ArrayObserver', 'count', () => {
	let a = [1, 3, 2];
	let n = 0;
	
	ArrayObserver.observe(a);
	
	ObjectObserver.listen(a, 'count', function () {
		n = this.count;
	});
	
	a.pop();
	
	assertEqual(n, 2);
});

test('ArrayObserver', 'listen and remove', () => {
	let a = [1, 3, 2];
	let b = [
		{ index: 2, items: [2] },
		{ index: 2, items: [4] },
		{ index: 0, items: [1] },
		{ index: 0, items: [5] },
		[{ before: 1, after: 0 }, { before: 2, after: 1 },
		{ before: 0, after: 2 }],
		[{ before: 2, after: 0 }, { before: 0, after: 2 }],
		{ index: 0, items: [0] },
	];
	let k = 0;
	
	function insert(data) {
		assertEqual(data, b[k++]);
	};
	
	function remove(data) {
		assertEqual(data, b[k++]);
	};
	
	function change(data) {
		assertEqual(data, b[k++]);
	};
	
	ArrayObserver.observe(a);
	
	ArrayObserver.listen(a, insert, remove, change);
	
	a.pop();
	
	a.push(4);
	
	a.shift();
	
	a.unshift(5);
	
	a.sort();
	
	a.reverse();
	
	a.splice(0, 0, 0);
	
	ArrayObserver.remove(a, insert, remove, change);
	
	a.splice(0);
	
	assertEqual(k, b.length);
	assertEqual(a, []);
});
