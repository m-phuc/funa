//#
//# include "lib.ts"
//#
//# if PARSER
//#   include "parser.ts"
export { ExprParser };
//#
//# elseif OBSERVER
//#   include "observer.ts"
export { ObjectObserver, ArrayObserver };
//#
//# else
//#   include "core.ts"
export { Funa };
//#
//# endif
//#