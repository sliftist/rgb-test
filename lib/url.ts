
let UID = Math.random();
let nextId = 0;
function randomUID(prefix = "UID") {
    return prefix + (+new Date()).toString() + "." + (nextId++);
}

export const trueParam = randomUID("true");
export function parseParams(paramsStr: string) {
    let paramsRaw = paramsStr.split("&").filter(x => !!x);
    let params: {[key: string]: string} = {};
    for(var i = 0; i < paramsRaw.length; i++) {
        let paramRaw = paramsRaw[i];
        let paramParts = paramRaw.split("=");
        let val: string = decodeURIComponent(paramParts[1]);
        if(paramParts.length === 1) {
            val = trueParam;
        }
        params[decodeURIComponent(paramParts[0])] = val;
    }
    return params;
}