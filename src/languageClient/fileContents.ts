
import { Location, Position } from 'vscode-languageclient';
import * as fs from 'fs';


const linesRe = /(^)/gm
const wordRe = /(\w+)/gm;

export class FilesContents {
	private contentLines: Map<string,  RegExpMatchArray[]> = new  Map<string, RegExpMatchArray[]> ();
	private content: Map<string, string> = new Map<string, string>();


	loadFileContent(file: string, content: string | null  = null):void {
		if (content) {
			this.contentLines.set(file, Array.from((<any>content).matchAll(linesRe)));
			this.content.set(file, content);
			return;
		}

		if(!this.contentLines.has(file) && fs.existsSync(file)) {
			content = fs.readFileSync(file).toString();

			const lines: RegExpMatchArray[] = Array.from((<any>content).matchAll(linesRe));
			this.contentLines.set(file, lines);
			this.content.set(file, content);
		}
	}

	getWord(location: Location): string | null {
		const file = location.uri;

		if(!this.contentLines.has(file)) {
			this.loadFileContent(file);
		}

		if(!this.contentLines.has(file)) {
			return null;
		}

		const range = location.range;
		const lines =  <RegExpMatchArray[]> this.contentLines.get(file);

		if (lines.length <= range.start.line) {
			return null;
		}

		const content = <string>this.content.get(file);

		const start = <number>lines[range.start.line].index + range.start.character;
		const end =  <number>lines[range.end.line].index + range.end.character || content.length;

		return content.substring(start, end);
	}

	getWordByPoint(file: string, position: Position): string | null {
		if(!this.contentLines.has(file)) {
			this.loadFileContent(file);
		}

		if(!this.contentLines.has(file)) {
			return null;
		}

		const lines =  <RegExpMatchArray[]> this.contentLines.get(file);
		if (lines.length <= position.line) {
			return null;
		}

		const content = <string>this.content.get(file);

		const start = <number>lines[position.line].index;
		const end = lines.length >= position.line + 1  ? <number>lines[position.line+1].index : content.length;
		const lineString = content.substring(start, end);

		const words: RegExpMatchArray[] = Array.from((<any>lineString).matchAll(wordRe));
		const character = position.character;

		const match = words.find(w => <number>w.index <= character && <number>w.index +w[0].length >= character);

		return !match ? null: match[0];
	}

};