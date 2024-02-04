# Funa

**Funa** is a JavaScript data binding library that allows you to create web apps with ease.

By extending HTML declarative syntax with interpolations and binding expressions, it seamlessly connects UI to underlying logical code, eliminating the need for complex DOM manipulation.

## Installation

Funa is a zero-dependency library.

Get the latest release [here](https://github.com/m-phuc/funa/releases), then import it as a module:

````js
import { Funa } from './funa.js';
````

For TypeScript support, store the ``funa.d.ts`` file alongside the ``funa.js`` file.

## Quick Start

Here is a basic example to give you a glance at:

````html
<!DOCTYPE html>
<html>
<head>
	<script src="demo.js" type="module"></script>
</head>
<body>
<template>
	<p>Hello {name}.</p>
</template>
</body>
</html>
````

````js
import { Funa } from './funa.js';

const app = new Funa({
	data: {
		name: 'world'
	}
});

app.render();
````

## Documentation

[Documentation](https://m-phuc.github.io/funa)

## License

[MIT License](https://opensource.org/license/mit)
