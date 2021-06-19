
import { Position } from 'vscode-languageclient';
import * as fs from 'fs';
import { normalizeWindowsPath } from '../helpers/pathHelper';
import { off } from 'process';
import { URI } from 'vscode-uri';
import { Location } from 'vscode-languageserver';


const wordRe = /(\w+)/gm;
const newLineSeparator = /\r?\n/gi;
const newLineW =  /\r\n/gi;

const getStartOfLineIndexes = (content) =>
{
	const offset = newLineW.test(content) ? 2 : 1;
	let length = 0;
	return content.split(newLineSeparator)
		.reduce((indexes, chunk)  => {
			length += chunk.length + offset
			indexes.push(length);
			return indexes;
		}, [0]);
}

export class FilesContents {
	private newLinesIndexes: Map<string,  number[]> = new  Map<string, number[]> ();
	private content: Map<string, string> = new Map<string, string>();

	loadFileContent(fileUri: string, content: string | null  = null):void {
		if (content) {
			this.newLinesIndexes.set(fileUri, getStartOfLineIndexes(content));
			this.content.set(fileUri, content);
			return;
		}

		const fileName = URI.parse(fileUri).fsPath;

		if(!this.newLinesIndexes.has(fileUri) && fs.existsSync(fileName)) {
			content = fs.readFileSync(fileName).toString();

			this.newLinesIndexes.set(fileUri, getStartOfLineIndexes(content));
			this.content.set(fileUri, content);
		}
	}


	getNewLineIndexes(filename: string): number[] {
		if(!this.newLinesIndexes.has(filename)) {
			this.loadFileContent(filename);
		}

		if(!this.newLinesIndexes.has(filename)) {
			return [];
		}


		return this.newLinesIndexes.get(filename) as number[];
	}

	getWord({uri, range}: Location): string | null {
		const lines = this.getNewLineIndexes(uri);

		if (lines.length <= range.start.line) {
			return null;
		}

		const content = <string>this.content.get(uri) || '';

		const start = lines[range.start.line] + range.start.character;
		const end =  lines[range.end.line] + range.end.character || content.length;

		return content.substring(start, end);
	}

	getWordByPoint(uri: string, position: Position): string | null {
		const lines = this.getNewLineIndexes(uri);

		if (lines.length <= position.line) {
			return null;
		}

		const content = <string>this.content.get(uri);

		const start = <number>lines[position.line];
		const end = lines.length >= position.line + 1  ? <number>lines[position.line+1] : content.length;
		const lineString = content.substring(start, end);

		const words: RegExpMatchArray[] = Array.from((<any>lineString).matchAll(wordRe));
		const character = position.character;

		const match = words.find(w => <number>w.index <= character && <number>w.index +w[0].length >= character);

		return !match ? null: match[0];
	}


	getLineEnder({uri, range}: Location): string | null{
		const lines = this.getNewLineIndexes(uri);

		if (lines.length <= range.end.line) {
			return null;
		}

		const content = <string>this.content.get(uri) || '';

		const start = lines[range.end.line] + range.end.character;
		const end =  ((lines[range.end.line + 1] || 1) - 1) || content.length;

		return content.substring(start, end);

	}


};