declare function $<T extends HTMLElement>(q: string, e?: ParentNode): T;

declare function $$<T extends HTMLElement>(q: string, e?: ParentNode): NodeListOf<T>;

declare function test(name: string, message: string, callback: Function): void;

declare function assert(expression: any, message: string): void;

declare function assertEqual(actual: any, expected: any): void;

declare function assertJson(actual: any, expected: any): void;

declare function assertThrow(callback: any, expected: any): void;
