export interface AndroidDevice { serial: string; state: string; detail: string }
export declare function parseAdbDevices(stdout: string): AndroidDevice[];
export declare function selectOnlineDevice(devices: readonly AndroidDevice[], preferred?: string): string;
export declare function parseInstrumentationReports(xmlDocuments: readonly string[]): {suites:number;tests:number;errors:number;failures:number;skipped:number};
export declare function parseInstrumentationOutput(stdout: string): {tests:number};
export declare function instrumentationArgs(serial:string,testPackage:string):string[];
