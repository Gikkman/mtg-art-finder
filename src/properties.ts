import props from "properties-reader";
import { Logger } from "./logger";
import { getAbsolutePath } from "./paths";

export function readProperties(fileRelativePath: string) {
    return props( getAbsolutePath(fileRelativePath) );
}

export function ensureProperty(property: string, props: props.Reader): string {
    const value = props.get(property);
    if(value === null) {
        throw "Missing property " + property
    } 
    const valueString = value.toString();
    Logger.debug(`Property detected. ${property}: ${valueString}`)
    return valueString;
}

export function ensurePropertyNumber(property: string, props: props.Reader): number {
    const value = ensureProperty(property, props);
    const valueNumber = Number(value);
    if( Number.isNaN(valueNumber) ) {
        throw "Properties " + property + " must be a number. Found " + valueNumber;
    }
    return valueNumber;
}