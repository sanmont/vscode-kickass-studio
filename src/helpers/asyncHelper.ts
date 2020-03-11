const { Subject } = require('await-notify');

export const delay = timeout => new Promise(resolve => setTimeout(resolve, timeout));

export const queuableFunction =  (func: (arg) => Promise<any>) =>  {
    let lastWait: Promise<any> = Promise.resolve(true);

    return async (...args) => {
        const currentWait = lastWait;
        const notif = new Subject();
        lastWait = notif.wait();

        const lastArg = args[args.length-1] || {};
        if (lastArg.flush) {
            notif.notify();
            return;
        }

        if (!lastArg.inmediate) {
            await currentWait;
        }


        let res:any;

        if (lastArg.dontWaitForResult) {
            res = func.apply(undefined, args);
        } else {
            res = await func.apply(undefined, args);
        }

        notif.notify();
        return res;
    }
};
