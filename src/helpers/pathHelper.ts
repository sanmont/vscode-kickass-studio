import * as fs from 'fs';
import * as path from 'path';

const oneLineCommentsRE = /\/\/.*/gi;
const multiLineCommentsRE = /\/\*.*\*\//gms;

export const eraseComments = (text) => text.replace(multiLineCommentsRE, '').replace(oneLineCommentsRE,'');

export const changeExtension = (filename, extension, directory='') => {
	const fileObj = path.parse(filename);
	fileObj.base = fileObj.name + extension;
	fileObj.dir = directory;
	if (directory === '') {
		fileObj.root = '';
	}

	return path.format(fileObj);
};

const flatten = (arr:[][]): any[] => {
	return arr.reduce((flat, curr) => flat.concat(curr) , []);
};

export const getAllFilesByExtension = (ext, dir) => {
	const files = (<string[]> fs.readdirSync(dir,'')).map(f => path.join(dir, f));
	const filesWithExt = files.filter(f => path.extname(f) === ext);
	const subfiles = <[][]> files.filter(f => fs.statSync(f).isDirectory()).map(getAllFilesByExtension.bind(undefined, ext));
	return filesWithExt.concat(flatten(subfiles));
};


export const canBeLaunched = (f) => {
	const contents = fs.readFileSync(f, 'utf8');
	return eraseComments(contents).includes('BasicUpstart');
};

export const instantiateJSONfileObject = (f) => {
	const json = fs.readFileSync(f, 'utf8');
	return JSON.parse(eraseComments(json));
};

export const isJSONFile = (f: string): boolean => path.extname(f) === '.json';

