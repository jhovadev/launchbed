export interface NativeLibrary {path:string;abi:string;compressed:boolean;loadSegments:number}
export function inspectApkBytes(bytes:Uint8Array):{status:'PASS';libraries:NativeLibrary[];detail:string};
export function inspectApk(path:string):{status:'PASS';libraries:NativeLibrary[];detail:string};
