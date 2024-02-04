const { chdir, cwd } = require('node:process');
const { exec } = require('node:child_process');
const { copyFileSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } = require('node:fs');
const { parse, resolve, sep } = require('node:path');

/**
 * @param {string} path
 * @returns {string}
 */
function read(path) {
	return readFileSync(path, 'utf8');
}

/**
 * @param {string} path
 * @param {string} data
 * @returns {void}
 */
function save(path, data) {
	writeFileSync(path, data, 'utf-8');
}

/**
 * @param {string} path
 * @param {Set<string>} vars
 * @returns {string}
 */
function include(path, vars, base = '.') {
	const keywords = ['define', 'include', 'if', 'else', 'elseif', 'endif'];
	
	/** @type {string[]} */
	const src = [];
	
	/** @type {string[]} */
	const tmp = [];
	
	/** @type {string[]} */
	const buf = [];
	
	/**
	 * @param {string} line
	 * @returns {string}
	 */
	function tokenize(line) {
		return line
			.replace(/"[^"]*"|\w+/g, (m) => {
				if (!m.startsWith('"')) {
					m = m.toLowerCase();
				}
				return keywords.includes(m) ? m : 'V' + (tmp.push(m) - 1);
			})
			.replace(/\s+/g, ' ');
	}
	
	path = resolve(base + sep + path);
	if (!existsSync(path)) {
		return;
	}
	
	read(path).split(/^\s*\/{2}\#(.*)\n/m).forEach((s, i) => {
		if (i % 2) {
			s = s.trim();
			if (s) {
				src.push(tokenize(s));
			}
		}
		else if (s) {
			src.push('T' + (tmp.push(s) - 1));
		}
	});
	
	/**
	 * 0: none
	 * 1: false
	 * 2: true
	 * 3: done
	 */
	let if_body = 0;
	
	for (let line of src) {
		if (if_body) {
			if (line === 'endif') {
				if_body = 0;
				continue;
			}
			
			if (if_body === 3) {
				continue;
			}
			
			if (line === 'else') {
				if_body++;
				continue;
			}
			else if (line.match(/^elseif V\d+$/)) {
				if (if_body === 1) {
					let v = tmp[line.substring(8)];
					if (!vars.has(v)) {
						continue;
					}
				}
				if_body++;
				continue;
			}
			
			if (if_body === 1) {
				continue;
			}
		}
		
		if (line.match(/^if V\d+$/)) {
			if (if_body) return;
			let v = tmp[line.substring(4)];
			if_body = vars.has(v) ? 2 : 1;
		}
		else if (line.match(/^T\d+$/)) {
			let t = tmp[line.substring(1)];
			buf.push(t);
		}
		else if (line.match(/^define V\d+$/)) {
			let v = tmp[line.substring(8)];
			vars.add(v);
		}
		else if (line.match(/^include V\d+$/)) {
			let v = tmp[line.substring(9)];
			let s = include(v.slice(1, -1), vars, parse(path).dir);
			if (s === undefined) {
				return;
			}
			buf.push(s);
		}
		else {
			return;
		}
	}
	
	if (if_body) {
		return;
	}
	
	return buf.join('\n');
}

/**
 * @param {string} cmd
 * @param  {...string} args
 * @returns {Promise<void>}
 */
function shell(cmd, ...args) {
	return new Promise((resolve, reject) => {
		exec(`${cmd} ${args.join(' ')}`, (error, stdout, stderr) => {
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		});
	});
}

/**
 * @param {string} src
 * @param {Record<string,any>} options
 * @param {string[]} vars
 * @returns {Promise<void>}
 */
function build(src, options, vars = []) {
	vars = vars.map(item => item.toLowerCase());
	
	let args = [];
	Object.entries(options).forEach(([key, val]) => {
		if (val === true) {
			args.push(`--${key}`);
		}
		else if (val !== undefined) {
			args.push(`--${key} ${val}`);
		}
	});
	
	let dir0 = cwd();
	let path = parse(src);
	
	//
	
	chdir(path.dir);
	let code = include(path.base, new Set(vars));
	chdir(dir0);
	if (!code) {
		return;
	}
	
	//
	
	save(path.base, code);
	let r = shell('tsc', path.base, ...args);
	r.finally(() => {
		chdir(dir0);
	});
	return r;
}

/**
 * @param {string} lib
 * @returns {Promise<void>}
 */
function min(lib) {
	let dst = lib.replace(/\.js$/, '.min.js');
	
	return shell(
		'terser',
		`"${lib}"`,
		'--compress keep_infinity=true,typeofs=false',
		'--mangle',
		'--ecma 2021',
		'--module',
		`--source-map "content=${lib}.map"`,
		`--output "${dst}"`,
	);
}

/**
 * @param {string} lib
 * @returns {void}
 */
function fix(lib, callback) {
	let src = read(lib);
	src = callback(src);
	save(lib, src);
}

async function main() {
	const options = {
		target: 'ES2021',
		module: 'ES2020',
		alwaysStrict: true,
		newLine: 'lf',
		removeComments: true,
	};
	
	const arg = process.argv[2];
	
	if (!arg || arg === 'test') {
		options.declaration = undefined;
		options.sourceMap = undefined;
		
		await build('../src/funa.ts', options);
		renameSync('funa.js', '../test/lib/funa.js');
		
		await build('../src/funa.ts', options, ['PARSER']);
		renameSync('funa.js', '../test/lib/parser.js');
		
		await build('../src/funa.ts', options, ['OBSERVER']);
		renameSync('funa.js', '../test/lib/observer.js');
	}
	
	if (!arg || arg === 'funa') {
		const version = read('../src/lib.ts').match(/VERSION = (.*)\n/)[1];
		const license = `
/**
 * Funa v${version}
 * 
 * https://github.com/m-phuc/funa
 * @license MIT
 */
`.trimStart();
		
		options.declaration = true;
		options.sourceMap = true;
		
		await build('../src/funa.ts', options);
		fix('funa.js', (src) => license + src);
		await min('funa.js');
		fix('funa.d.ts', (src) => src.replace(/declare function Funa[^;]*;\n/, ''));
		
		copyFileSync('funa.min.js', '../docs/assets/funa.js');
		renameSync('funa.ts', '../dist/funa.ts');
		renameSync('funa.d.ts', '../dist/funa.d.ts');
		renameSync('funa.min.js', '../dist/funa.js');
		renameSync('funa.min.js.map', '../dist/funa.js.map');
	}
	
	['funa.ts', 'funa.js', 'funa.js.map'].forEach(file => {
		if (existsSync(file)) {
			unlinkSync(file);
		}
	});
}

main();