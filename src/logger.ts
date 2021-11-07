enum LogLevel {
    ERROR = 0,
    INFO = 3,
    DEBUG = 5,
}
let logLevel: LogLevel;

export const Logger = {
    
    info: (...args: any) => {
        if(logLevel >= LogLevel.INFO)
            console.log(...args)
    },
    
    debug: (...args: any) => {
        if(logLevel >= LogLevel.DEBUG)
            console.log(...args);
    },
    
    error: (...args: any) => {
        if(logLevel >= LogLevel.ERROR)
            console.error(...args);
    }

}

export function configureLogger(logLevel?: string) {
    if(logLevel !== 'error' && logLevel !== 'info' && logLevel !== 'debug') {
        setLogLevel('info');
        Logger.info(`Invalid log level '${logLevel}'. Defaulting to 'info'.`);
    } else {
        setLogLevel(logLevel);
        Logger.info(`Log level set to' ${logLevel}'.`);
    }
}

function setLogLevel(level: 'error'|'info'|'debug') {
    switch(level) {
        case 'error': logLevel = LogLevel.ERROR; break;
        case 'info': logLevel = LogLevel.INFO; break;
        case 'debug': logLevel = LogLevel.DEBUG; break;
    }
}