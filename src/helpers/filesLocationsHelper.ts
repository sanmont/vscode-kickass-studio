import * as fs from 'fs';
import * as path from 'path';
import { changeExtension, getAllFilesByExtension } from "./pathHelper"



// In the case there are segments defined in the sourcecode along with a different output file
// this takes care of guessing a dbg file to get the debug info
export const guessDBGFile = (program, binDirectory): string => {
	const defaultdbg = changeExtension(program, '.dbg', binDirectory);
	if (fs.existsSync(defaultdbg)) {
		return defaultdbg;
	}

	const dbgFiles = getAllFilesByExtension('.dbg', binDirectory);

	if (dbgFiles.length) {
		return dbgFiles[0];
	}


	return ''
}