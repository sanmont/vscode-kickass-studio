

export enum VariableFormat {
	DEC,
	HEX,
	BIN,
	BOOL,
	CHAR
}


export interface IVariableInfo {
	from: string;
	to: string;
	format: VariableFormat;
	derreference: number;
	range: number;
	directValue?: boolean;
}

const memAddressRe = /\$[0-f]{4}/;
const lengthRe = /.*\[(\d+)\]/gi;
const withFormatRe = /\:(\w+)/;
const wordRe =  /(\w+)/;
const formatRe = /(h|d|b|c|l|bool)\:/i;
const derreferenceRe = /^\*+/

const parseLength = (varname) => {
	const matches =  [...varname.matchAll(lengthRe)];

	if (!(matches || []).length) {
		return 0;
	}

	return parseInt(matches[0][1], 10) - 1;
};

const getMemoryAddress = (variablename, memoryMap) => {
	if (memAddressRe.test(variablename)) {
		return variablename.match(memAddressRe)[0];
	}

	let label = '';

	if (withFormatRe.test(variablename)) {
		label = variablename.match(withFormatRe)[1];
	} else {
		label =  variablename.match(wordRe)[0]
	}

	return memoryMap[label];
};

export const addToMemoryAddress = (memoryAddress, val) => {
	if (!memoryAddress) return '' ;
	let address = parseInt(memoryAddress.match(wordRe)[0], 16);
	address += val;

	return '$' + address.toString(16).padStart(4, '0');
};

export const dereferenceToAddress = (variable: IVariableInfo, derreferencedAddress: string): IVariableInfo => {

	const range = variable.range;
	const from = derreferencedAddress;
	const to = addToMemoryAddress(from, range);
	const format =  variable.format;
	const derreference = 0;

	return {
		range,
		from,
		to,
		format,
		derreference
	}
}

const parseFormat = (variablename) => {
	const match = variablename.match(formatRe);

	const char = ((match || [])[1] || 'h').toLowerCase();

	switch(char) {
		case 'd':
			return VariableFormat.DEC;
		case 'b':
			return VariableFormat.BIN;
		case 'l':
		case 'bool':
			return VariableFormat.BOOL;
		case 'c':
			return VariableFormat.CHAR;
		default:
			return VariableFormat.HEX;
	}

};

const parseDerreference = (variablename) => {
	const match = variablename.match(derreferenceRe);

	if (!match) return 0;
	return match[0].length;
};

export const parseVariable = (variablename, memoryMap): IVariableInfo | null => {
	const from = getMemoryAddress(variablename, memoryMap);

	if (!from) {
		return null;
	}

	const range = parseLength(variablename);
	const to = addToMemoryAddress(from, range);
	const format =  parseFormat(variablename);
	const derreference = parseDerreference(variablename);
	const directValue = (variablename.trim() as string).startsWith('#')


	return {
		range,
		from,
		to,
		format,
		derreference,
		directValue
	}

}