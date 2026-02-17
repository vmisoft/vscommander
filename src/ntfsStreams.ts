import * as os from 'os';

interface StreamInfo {
    streamCount: number;
    streamTotalSize: number;
}

let ffiState: undefined | null | {
    FindFirstStreamW: Function;
    FindNextStreamW: Function;
    FindClose: Function;
    WIN32_FIND_STREAM_DATA: any;
    INVALID_HANDLE: any;
};

function initFfi(): typeof ffiState {
    if (ffiState !== undefined) return ffiState;
    if (os.platform() !== 'win32') {
        ffiState = null;
        return ffiState;
    }
    try {
        const koffi = require('koffi');
        const kernel32 = koffi.load('kernel32.dll');

        const WIN32_FIND_STREAM_DATA = koffi.struct('WIN32_FIND_STREAM_DATA', {
            StreamSize: 'int64',
            cStreamName: koffi.array('char16', 296, 'array'),
        });

        const FindFirstStreamW = kernel32.stdcall(
            'FindFirstStreamW', 'void *', ['str16', 'uint32', koffi.out(koffi.pointer(WIN32_FIND_STREAM_DATA)), 'uint32']
        );
        const FindNextStreamW = kernel32.stdcall(
            'FindNextStreamW', 'bool', ['void *', koffi.out(koffi.pointer(WIN32_FIND_STREAM_DATA))]
        );
        const FindClose = kernel32.stdcall(
            'FindClose', 'bool', ['void *']
        );

        const INVALID_HANDLE = koffi.as(-1, 'void *');

        ffiState = { FindFirstStreamW, FindNextStreamW, FindClose, WIN32_FIND_STREAM_DATA, INVALID_HANDLE };
        return ffiState;
    } catch {
        ffiState = null;
        return ffiState;
    }
}

export function getStreamInfo(fullPath: string): StreamInfo | undefined {
    const ffi = initFfi();
    if (!ffi) return undefined;
    try {
        const data: any = {};
        const handle = ffi.FindFirstStreamW(fullPath, 0, data, 0);
        if (handle === ffi.INVALID_HANDLE || handle === null) return undefined;

        let count = 0;
        let totalSize = 0;
        do {
            const size = Number(data.StreamSize ?? 0);
            const nameChars: number[] = data.cStreamName ?? [];
            let name = '';
            for (let i = 0; i < nameChars.length; i++) {
                if (nameChars[i] === 0) break;
                name += String.fromCharCode(nameChars[i]);
            }
            if (name === '::$DATA') continue;
            count++;
            totalSize += size;
        } while (ffi.FindNextStreamW(handle, data));

        ffi.FindClose(handle);
        return { streamCount: count, streamTotalSize: totalSize };
    } catch {
        return undefined;
    }
}
