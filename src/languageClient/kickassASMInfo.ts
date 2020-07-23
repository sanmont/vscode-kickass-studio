import * as path from 'path';
import * as uniqueFilename from 'unique-filename';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { FilesContents } from './fileContents';
import { TextDocument, Location, DocumentUri , Position, Range} from 'vscode-languageclient';
import { IKickConfig } from '../helpers/extension';
import { URI } from 'vscode-uri';


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
	symbolReference?: ASMToken[]
}

export interface ASMInfo { // Cambiarla a clase
	errors: ASMInfoErrors;
	syntax: ASMInfoSyntax;
};


const generateASMString = async (fileUri: string, replacements: Map<string, string> , {kickAssJar, javaBin}): Promise<string> => {
	const fileName = URI.parse(fileUri).fsPath;
	const cwd = path.dirname(fileName);

	// tslint:disable-next-line: no-require-imports
	const errorFilename = uniqueFilename(os.tmpdir());
	const tempFile = uniqueFilename(os.tmpdir());
	fs.writeFileSync(tempFile, replacements);

	const replacementsArgs = [];

	replacements.forEach((content, replaceFilename) => {
		const tempFile = uniqueFilename(os.tmpdir());
		fs.writeFileSync(tempFile, content);
		Array.prototype.push.apply(replacementsArgs,['-replacefile', replaceFilename, tempFile]);
	});

	return await new Promise(resolve => {
		let output = '';
		const proc = spawn(
			javaBin,
			['-jar',kickAssJar, fileName, '-asminfo', 'allSourceSpecific', '-noeval','-asminfofile', errorFilename].concat(replacementsArgs),
			{ cwd }
		);

		proc.stderr.on('data', data => {
			output += data;
		});

		proc.on('close', () => {
			output = fs.readFileSync(errorFilename).toString();
			fs.unlinkSync(errorFilename);
			fs.unlinkSync(tempFile)
			resolve(output);
		});
	});
};

const parseFilesSection = (section: string) => {
	return 	section.split('\n').map(l => l.split(';')[1]);
};

const parseRange = (rangeString: string, files: string[]): Location => {
	const [ line1, character1, line2, character2, fileIndex] = rangeString.split(',');

	const startLine = parseInt(line1,10) - 1;
	const startCharacter =  parseInt(character1,10) - 1;

	const endLine = parseInt(line2,10) - 1;
	const endCharacter =  parseInt(character2, 10);


	const uri: DocumentUri = files[fileIndex]
	const range: Range = {
		start: { line:startLine, character: startCharacter},
		end: { line:endLine, character: endCharacter}
	}
	return { uri, range };
};

const parseSyntaxSection = (section: string, files: string[]): Map<string, ASMInfoSyntax> => {
	return section.split('\n').reduce((res: Map<string, ASMInfoSyntax> , line:string) => {
		const [type, rangeAndFile] = line.split(';');
		const range = parseRange(rangeAndFile, files);

		if(!res.has(range.uri)){
			res.set(range.uri, {});
		}

		const asmInfo = <ASMInfoSyntax>res.get(range.uri);

		if (!asmInfo[type]) {
			asmInfo[type] = [];
		}


		asmInfo[type].push({range, value: ''})
		return res;
	}, new Map<string, ASMInfoSyntax>() );
};

const parseErrorsSection = (section: string, files: string[]): Map<string, ASMInfoErrors> => {
	const res = new Map<string, ASMInfoErrors>();

	files.forEach(f => res.set(f, { Error: []}));

	if (!section) return res;

	return section.split('\n').reduce((dict: Map<string, ASMInfoErrors>, line:string) => {
		const [type, rangeAndFile, message] = line.split(';');

		const range = parseRange(rangeAndFile, files);

		const infoError = <ASMInfoErrors> dict.get(range.uri);

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

const parseAsmInfoString = (str: string, contents: Map<string, string> ):Object => {
	const re =  /\[.*\]/g;
	const matches = str.match(re);
	const sections = str.split(re).map(s => s.trim());
	sections.shift() // getting rid of the empty first element

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
			errors: errors.get(file)
		};
	})

	return result;
}

export const getASMInfo = async (filename, replacements, settings): Promise<Object> => {
	const asmInfoString = await generateASMString(filename, replacements, settings);
	return parseAsmInfoString(asmInfoString, replacements);
};

export class ASMInfoAnalizer {
	private filesContents: FilesContents = new FilesContents();
	private asmInfoByFile: Object = {};
	private replacements: Map<string, string> = new Map<string, string>();

	private forEachFileInASMInfo(asmInfoByFile, callBack: (asminfo: ASMInfo) => void ) {
		Object.keys(asmInfoByFile).forEach((filename) => {
			callBack(asmInfoByFile[filename]);
		});
	}

	private forEachSyntaxType(asminfo: ASMInfo, callBack: (tokens: ASMToken[]) => void) {
		const syntaxInfo = asminfo.syntax;

		Object.keys(syntaxInfo).forEach((syntaxType) => {
			callBack(<ASMToken[]> syntaxInfo[syntaxType]);
		});
	}

	private setSyntaxValues(asmInfoByFile): void {
		this.forEachFileInASMInfo(asmInfoByFile, asmInfo => {
			this.forEachSyntaxType(asmInfo, (tokens ) => {
				tokens.forEach((token: ASMToken) => {
					token.value = this.filesContents.getWord(token.range);
				})
			})
		});
	}

	useFilesystemContent(file: string): boolean {
		return this.replacements.delete(file);
	}

	async analize(document: TextDocument, settings: IKickConfig): Promise<Object | null> {
		const fileName = URI.parse(document.uri).fsPath;

		const content =  document.getText();
		this.replacements.set(fileName, content);

		const asmInfoString = await generateASMString(document.uri, this.replacements, settings);
		const newInfo = parseAsmInfoString(asmInfoString, this.replacements);

		this.filesContents.loadFileContent(fileName, content);
		this.setSyntaxValues(newInfo);

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
				location  = asminfo.syntax.label?.find(labelDef => labelDef.value === label)?.range;
			}
		});

		return location;
	}

	getSymbolReferences(word: string): Location [] {
		let locations: Location[] = [];

		if (word.endsWith(':')) {
			word = word.substring(0,word.length-1)
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

	getWord(uri:string, pos: Position): string | null {
		const fileName = URI.parse(uri).fsPath;
		return this.filesContents.getWordByPoint(fileName, pos);
	}

 	hasFileBeenAnalized(uri: string): Boolean {
		const fileName = URI.parse(uri).fsPath;
		return Boolean(this.asmInfoByFile[fileName]);
	 }

}