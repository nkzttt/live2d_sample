const fn = (o: { foo?: any }): boolean => {
    return typeof o.foo !== 'undefined';
};

console.log(fn({ bar: 1 }));