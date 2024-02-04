const enum RUNTIME {
	VERSION = 1.0
}

type FunaAs<T, U> = {
	convert?: (value: T, ...args: (string | number)[]) => U;
	revert?: (value: U, ...args: (string | number)[]) => T;
}

type FunaIf = (...args: (string | number)[]) => boolean

type FunaIs = {
	[key: string]: (string | FunaIs)
}

type FunaOn = (sender: Element, event: Event, ...args: (string | number)[]) => void

interface FunaConfig {
	bypassTags: string[];
}

interface FunaInit {
	config?: FunaConfig;
	data?: Record<string, any>;
	as?: Record<string, FunaAs<any, any>>;
	if?: Record<string, FunaIf>;
	is?: Record<string, FunaIs>;
	on?: Record<string, FunaOn>;
}

interface FunaPropertyDescriptor extends PropertyDescriptor {
	links: (string | { src: any, prop: string })[];
}

declare class Funa<T extends FunaInit> {
	constructor(init?: T);
	
	version: number;
	
	data: Record<string, any> & T['data'];
	as: Record<string, FunaAs<any, any>> & T['as'];
	if: Record<string, FunaIf> & T['if'];
	is: Record<string, FunaIs> & T['is'];
	on: Record<string, FunaOn> & T['on'];
	
	render: (target?: Element, name?: string) => void;
	
	depend(target: any, dependencyProperty: string, sourceProperty: string | string[]): void;
	depend(target: any, dependencyProperty: string, source: any, sourceProperty: string | string[]): void;
	
	define(target: any, property: string, descriptor: FunaPropertyDescriptor): void;
	
	notify(target: any, property: string): void;
}
