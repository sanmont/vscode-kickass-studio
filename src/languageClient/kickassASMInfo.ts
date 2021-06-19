import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as uniqueFilename from 'unique-filename';
import { DocumentUri } from 'vscode-languageclient';
import { Range, Location, TextDocument, Position } from  'vscode-languageserver';
import { URI } from 'vscode-uri';
import { IKickConfig } from '../helpers/extension';
import { FilesContents } from './fileContents';

export interface ASMInfoError {
	location: Location;
	message: string;
}


export interface ASMInfoErrors {
	Error: ASMInfoError[];
	Warning?: ASMInfoError[];
}


export interface ASMToken {
	range: Location;
	value: string | null;
}



export interface ASMInfoSyntax {
	comment?: ASMToken[];
	directive?: ASMToken[];
	functionCall?: ASMToken[];
	label?: ASMToken[];
	macroExecution?: ASMToken[];
	mnemonic?: ASMToken[];
	ppDirective?: ASMToken[];
	pseudoCommandExecution?: ASMToken[];
	symbolReference?: ASMToken[];
}

export interface ASMInfo { // Cambiarla a clase
	errors: ASMInfoErrors;
	syntax: ASMInfoSyntax;
	definitions?: Map<string, ASMToken>;
}

interface constAssigment {
	name: string;
	value: string;
}


const newLineSeparatorRE = /\r?\n/gi;
const constAssignmentRE = /[\w|\"]+/gi

const getConstAssignment = (assignment: string): constAssigment  =>{
	const array = [...assignment.matchAll(constAssignmentRE)];
	return { name: array[0].toString(), value: array[1].toString()};
}

const generateASMString = async (fileUri: string, replacements: Map<string, string>, { kickAssJar, javaBin }): Promise<string> => {
	const fileName = URI.parse(fileUri).fsPath;
	const cwd = path.dirname(fileName);

	// tslint:disable-next-line: no-require-imports
	const errorFilename = uniqueFilename(os.tmpdir());
	const tempFile = uniqueFilename(os.tmpdir());
	fs.writeFileSync(tempFile, replacements.get(fileUri));

	const replacementsArgs = [];

	replacements.forEach((content, replaceFilename) => {
		const tempFile = uniqueFilename(os.tmpdir());
		fs.writeFileSync(tempFile, content);
		Array.prototype.push.apply(replacementsArgs, ['-replacefile',
		URI.parse(replaceFilename).fsPath, tempFile]);
	});

	return await new Promise(resolve => {
		let output = '';

		var args = 	['-jar', kickAssJar, fileName, '-asminfo',
		'allSourceSpecific', '-noeval', '-asminfofile',
		errorFilename].concat(replacementsArgs);

		const proc = spawn(
			javaBin,
			['-jar', kickAssJar, fileName, '-asminfo',
				'allSourceSpecific', '-noeval', '-asminfofile',
				errorFilename].concat(replacementsArgs),
			{ cwd }
		);


		proc.stderr.on('data', data => {
			output += data;
		});

		proc.on('close', () => {
			if (fs.existsSync(errorFilename)) {
				output = fs.readFileSync(errorFilename).toString();
				fs.unlinkSync(errorFilename);
				fs.unlinkSync(tempFile);
			} else {
				output = '';
			}

			resolve(output);
		});

	});
};

const parseFilesSection = (section: string) => {
	return section.split(newLineSeparatorRE).map(l => URI.file(l.split(';')[1]).toString());
};

const parseRange = (rangeString: string, files: string[]): Location => {
	const [line1, character1, line2, character2, fileIndex] =
		rangeString.split(',');

	const startLine = parseInt(line1, 10) - 1;
	const startCharacter = parseInt(character1, 10) - 1;

	const endLine = parseInt(line2, 10) - 1;
	const endCharacter = parseInt(character2, 10);


	const uri: DocumentUri = files[fileIndex];
	const range: Range = {
		start: { line: startLine, character: startCharacter },
		end: { line: endLine, character: endCharacter }
	};
	return { uri, range };
};

const parseSyntaxSection = (section: string, files: string[]): Map<string, ASMInfoSyntax> => {
	return section.split(newLineSeparatorRE).reduce((res: Map<string, ASMInfoSyntax>, line: string) => {
		const [type, rangeAndFile] = line.split(';');
		const range = parseRange(rangeAndFile, files);

		if (!res.has(range.uri)) {
			res.set(range.uri, {});
		}

		const asmInfo = <ASMInfoSyntax>res.get(range.uri);

		if (!asmInfo[type]) {
			asmInfo[type] = [];
		}


		asmInfo[type].push({ range, value: '' });
		return res;
	}, new Map<string, ASMInfoSyntax>());
};

const parseErrorsSection = (section: string, files: string[]):Map<string, ASMInfoErrors> => {
	const res = new Map<string, ASMInfoErrors>();

	files.forEach(f => res.set(f, { Error: [] }));

	if (!section) return res;

	return section.split(newLineSeparatorRE).reduce((dict: Map<string, ASMInfoErrors>, line: string) => {
		const [type, rangeAndFile, message] = line.split(';');

		const range = parseRange(rangeAndFile, files);

		const infoError = <ASMInfoErrors>dict.get(range.uri);

		if (!infoError[type]) {
			infoError[type] = [];
		}

		infoError[type].push({
			location: parseRange(rangeAndFile, files),
			message
		});


		return dict;
	}, res);
};

const parseAsmInfoString = (str: string, contents: Map<string, string>): Object => {
	const re = /\[.*\]/g;
	const matches = str.match(re);
	const sections = str.split(re).map(s => s.trim());
	sections.shift(); // getting rid of the empty first element

	let i = matches?.indexOf('[files]') || 0;
	const files = parseFilesSection(sections[i]);

	i = matches?.indexOf('[syntax]') || 0;
	const syntax = parseSyntaxSection(sections[i], files);

	i = matches?.indexOf('[errors]') || 0;
	const errors = parseErrorsSection(sections[i], files);

	const result = {};

	files.forEach(file => {
		result[file] = {
			syntax: syntax.get(file),
			errors: errors.get(file),
			definitions: new Map<string, ASMToken>()
		};
	});

	return result;
};

export class ASMInfoAnalizer {
	private filesContents: FilesContents = new FilesContents();
	private asmInfoByFile: Object = {};
	private replacements: Map<string, string> = new Map<string, string>();

	private forEachFileInASMInfo(asmInfoByFile, callBack: (asminfo: ASMInfo) => void) {
		Object.keys(asmInfoByFile).forEach((filename) => {
			callBack(asmInfoByFile[filename]);
		});
	}

	private forEachSyntaxType(asminfo: ASMInfo, callBack: (tokens: ASMToken[]) => void) {
		const syntaxInfo = asminfo.syntax;

		Object.keys(syntaxInfo).forEach((syntaxType) => {
			callBack(<ASMToken[]>syntaxInfo[syntaxType]);
		});
	}

	private setSyntaxValues(asmInfoByFile): void {
		this.forEachFileInASMInfo(asmInfoByFile, (asmInfo) => {
			this.forEachSyntaxType(asmInfo, (tokens) => {
				tokens.forEach((token: ASMToken) => {
					token.value = this.filesContents.getWord(token.range);
				});
			});
		});
	}

	private setDefinitions(asmInfoByFile): void {
		this.forEachFileInASMInfo(asmInfoByFile, (asmInfo: ASMInfo) => {
			if (asmInfo.syntax.directive) {
				asmInfo.syntax.directive.forEach((directiveToken) => {
					const word = this.filesContents.getWord(directiveToken.range);
					if (word === '.const') {
						const rest = this.filesContents.getLineEnder(directiveToken.range);
						const constAssigment = getConstAssignment(rest || "");
						asmInfo.definitions?.set(constAssigment.name, { range: directiveToken.range, value: constAssigment.value });
					}
				});
			};

			if (asmInfo.syntax.label) {
				asmInfo.syntax.label.forEach(label => {
					asmInfo.definitions?.set(label.value as string, label);
				})
			}
		});
	}
	async analize(document: TextDocument, settings: IKickConfig): Promise<Object | null> {
		const fileName = document.uri;

		const content = document.getText();
		this.replacements.set(fileName, content);

		const asmInfoString = await generateASMString(document.uri,
			this.replacements, settings);

		if (!asmInfoString) {
			return null;
		}

		const newInfo = parseAsmInfoString(asmInfoString, this.replacements);

		this.filesContents.loadFileContent(fileName, content);
		this.setSyntaxValues(newInfo);
		this.setDefinitions(newInfo);

		this.asmInfoByFile = { ...this.asmInfoByFile, ...newInfo };
		return null;
	}

	getLabel(label: string): Location | undefined {
		let location: Location | undefined;


		if (!label.endsWith(':')) {
			label += ':';
		}

		this.forEachFileInASMInfo(this.asmInfoByFile, (asminfo) => {
			if (!location) {
				location = asminfo.definitions?.get(label)?.range;
			}
		});

		return location;
	}

	getDefinition(word: string): Location | undefined {
		let location: Location | undefined;


		this.forEachFileInASMInfo(this.asmInfoByFile, (asminfo) => {
			if (!location) {
				location = asminfo.definitions?.get(word)?.range;
			}
		});

		return location;
	}


	getSymbolReferences(word: string): Location[] {
		let locations: Location[] = [];

		if (word.endsWith(':')) {
			word = word.substring(0, word.length - 1);
		}

		this.forEachFileInASMInfo(this.asmInfoByFile, (asminfo) => {
			asminfo.syntax
				.symbolReference?.filter(symbol => symbol.value === word)
				.forEach(element => {
					locations.push(element.range);
				});
		});

		return locations;
	}

	getErrors(): ASMInfoError[] {
		let errors: ASMInfoError[] = [];
		this.forEachFileInASMInfo(this.asmInfoByFile, (asminfo) => {
			errors = errors.concat(asminfo.errors.Error);
		});

		return errors;
	}

	getWord(uri: string, pos: Position): string | null {
		return this.filesContents.getWordByPoint(uri, pos);
	}

	hasFileBeenAnalized(uri: string): Boolean {
		return Boolean(this.asmInfoByFile[uri]);
	}

}