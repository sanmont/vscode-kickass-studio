import { parse } from 'fast-xml-parser';
import { readFileSync } from 'fs';
import * as path from 'path';


export interface SourceLocation {
	address: string;
	filename: string;
	line: number;
	column: number;
}


// Normalize To an array:
// If the metadata in the dbg file has only one element returns an array of that element. if its already an array,
// it returns the array
const normalizeToArray = (obj): any[] => Array.isArray(obj) ? obj : [obj];

// TODO: change filename to URI
const parseSources = (sourceStr: string) => {
	return sourceStr.split('\n').reduce((sources, curr) => {
		const [id, filename] = curr.trim().split(',');
		sources[id] = filename;
		return sources;
	}, {});
};

const parseBlock = (block: string, filesIndex): Array<SourceLocation> => {
	return block.split('\n').map(curr => {
		const [START, , FILE_IDX, LINE1, COL1] = curr.trim().split(',');
		return {
			address: START,
			filename: filesIndex[FILE_IDX],
			line: parseInt(LINE1, 10),
			column: parseInt(COL1, 10)
		};
	});
};


const parseBlocks = (block: string | string[], filesIndex): Array<SourceLocation> => {
	const blocks = normalizeToArray(block);
	return blocks.reduce((map, currBlock) => {
		return map.concat(parseBlock(currBlock, filesIndex));
	}, [] as Array<SourceLocation>);
};

const parseSegments = (segment: any | any[], filesIndex): Array<SourceLocation> => {
	const segments = normalizeToArray(segment);
	return segments.reduce((map, currSegment) => {
		if (!currSegment) {
			return map;
		}
		return map.concat(parseBlocks(currSegment.Block as string, filesIndex));
	}, [] as Array<SourceLocation>);
}

const parseLabels = (labels: string): Object => {
	return labels.split('\n').reduce((labelsMap, curr) => {
		const [, address, name] = curr.trim().split(',');
		labelsMap[name] = address;
		return labelsMap;
	}, {});
};

const isSameFile = (file1, file2) => !path.relative(file1,file2)

export class SourceMap {
	public memSourceLocation: Array<SourceLocation> = [];
	public labelsMap = {};

	public loadDBG(filename) {
		const xmldata = readFileSync(filename);
		const jsonObj = parse(xmldata.toString());
		const filesIndex = parseSources(jsonObj.C64debugger.Sources);
		this.memSourceLocation = parseSegments(jsonObj.C64debugger.Segment, filesIndex);
		this.labelsMap = parseLabels(jsonObj.C64debugger.Labels);
	}

	public getSourceLocation(address): SourceLocation | null {
		let i = this.memSourceLocation.length - 1;
		for (; i >= 0 && this.memSourceLocation[i].address > address; i--);
		return this.memSourceLocation[i];
	}

	public getLabelFile(label): string | null {
		const address = this.labelsMap[label];
		return (this.getSourceLocation(address) || { filename: null }).filename;
	}

	public getAddressFromSource(filename: string, line: number): SourceLocation | null {
		let i = 0;
		for (; i < this.memSourceLocation.length; i++) {
			const location = this.memSourceLocation[i];
			if (isSameFile(location.filename,filename) && location.line === line) break;
		}

		return this.memSourceLocation[i];
	}

	public isFromFilename(address: string, filename: string): boolean {
		return isSameFile(this.getSourceLocation(address)?.filename, filename);
	}
}
