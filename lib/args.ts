import { parseParams, trueParam } from "./url";
import { g } from "./global";

function isNode() {
    return typeof window === "undefined";
}

declare var ADDITIONAL_ARGUMENTS: { [key: string]: string }|undefined;
if(!g.ADDITIONAL_ARGUMENTS) {
    g.ADDITIONAL_ARGUMENTS = Object.create(null);;
}

export function getProgramArguments(): {[key: string]: string} {
    let commandLineOptions: {[key: string]: string} = Object.create(null);
    if (isNode()) {
       
        for(let i = 0; i < process.argv.length; i++) {
            let arg = process.argv[i];
            
            let index = arg.indexOf("=");
            if (index < 0) {
                commandLineOptions[arg] = true + "";
            } else {
                let key = decodeURIComponent(arg.substr(0, index));
                let value = decodeURIComponent(arg.substr(index + 1));
        
                commandLineOptions[key] = value;

                if(key.startsWith("--")) {
                    commandLineOptions[key.substr(2)] = value;
                }
                if(key.startsWith("-")) {
                    commandLineOptions[key.substr(1)] = value;
                }
            }
        }
    } else {
        commandLineOptions = parseParams(document.location ? document.location.hash.slice(1) : "");
        let commandLineOptionsSearch = parseParams(document.location ? document.location.search.slice(1) : "");
        for(let key in commandLineOptionsSearch) {
            commandLineOptions[key] = commandLineOptionsSearch[key];
        }
    }
    return Object.assign(Object.create(null), ADDITIONAL_ARGUMENTS || {}, commandLineOptions);
}

export function setProgramArgument(key: string, value: string) {
    if(g.NODE_CONSTANT) {
        throw new Error(`Cannot set program argument in a node program. Tried to set argument ${key} to ${JSON.stringify(value)}`);
    } else {
        let params = getProgramArguments();
        params[key] = value;

        let parts: string[] = [];
        for(let key in params) {
            let val = params[key];
            if(val === trueParam) {
                parts.push(`${key}`);
            } else {
                parts.push(`${key}=${encodeURIComponent(val)}`);
            }
        }

        history.pushState(null, "", "?" + parts.join("&"));
    }
}