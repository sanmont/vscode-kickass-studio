'use strict';

import { spawn } from 'child_process';
import * as path from 'path';
import {
	createConnection,
	Diagnostic,
	DiagnosticSeverity,
	DidChangeConfigurationNotification,
	Position,
	ProposedFeatures,
	TextDocuments
} from 'vscode-languageserver';
import { URI } from 'vscode-uri';

const kickassRunnerJar = path.join(__dirname, 'KickAssRunner.jar');

const defaultSettings = { kickAssJar: '/Applications/KickAssembler/KickAss.jar', javaBin: 'java' };
let globalSettings = defaultSettings;
const documentSettings = new Map();

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments();

let hasConfigurationCapability = false;

connection.onInitialize(({ capabilities }) => {
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);

	return {
		capabilities: {
			textDocumentSync: documents.syncKind
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type);
	}
});

documents.onDidChangeContent(change => {
	validateDocument(change.document);
});

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = change.settings['kickass-studio'] || defaultSettings;
	}

	documents.all().forEach(validateDocument);
});

function getDocumentSettings(resource) {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}

	let result = documentSettings.get(resource);

	if (!result) {
		result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'kickass-studio' });
		documentSettings.set(resource, result);
	}

	return result;
}

async function validateDocument(document) {
	const errors: Diagnostic[] = await getErrors(document);
	connection.sendDiagnostics({ uri: document.uri, diagnostics: errors || [] });
}

async function getErrors(document): Promise<Diagnostic[]> {
	const settings = await getDocumentSettings(document.uri);
	const fileName = URI.parse(document.uri).fsPath;

	const asmInfo: string = await new Promise(resolve => {
		let output = '';

		const proc = spawn(
			settings.javaBin,
			['-cp', `${settings.kickAssJar}:${kickassRunnerJar}`, 'com.noice.kickass.KickAssRunner', fileName, '-asminfo', 'errors', '-asminfo', 'files'],
			{ cwd: path.dirname(fileName) }
		);

		proc.stdout.on('data', data => {
			output += data;
		});

		proc.on('close', () => {
			resolve(output);
		});

		proc.stdin.write(document.getText());
		proc.stdin.end();
	});

	const filesIndex = asmInfo.indexOf('[files]');
	const errorsIndex = asmInfo.indexOf('[errors]');
	const filesPart = asmInfo.substring(filesIndex, errorsIndex > filesIndex ? errorsIndex : undefined);
	const errorsPart = asmInfo.substring(errorsIndex, filesIndex > errorsIndex ? filesIndex : undefined);

	const currentFileNumber = filesPart
		.split('\n')
		.slice(1)
		.map(line => {
			const [number, file] = line.split(';');
			return { number, file };
		})
		.filter(({ file }) => file === fileName)
		.map(({ number }) => Number(number))[0];

	const errors = <Diagnostic[]>errorsPart
		.split('\n')
		.slice(1)
		.map(parseLine)
		.filter(({ fileNumber }) => fileNumber === currentFileNumber)
		.map(toError)
		.filter(Boolean);

	return errors;

	function parseLine(line) {
		const [, positions, message] = (line || '').split(';');
		const [startRow, startPos, endRow, endPos, fileNumber] = (positions || '').split(',').map(Number);
		return {
			message,
			startRow,
			startPos,
			endRow,
			endPos,
			fileNumber
		};
	}

	function toError({ startRow, startPos, endRow, endPos, message }) {
		if (!startRow || !startPos || !endRow || !endPos || !message) return;
		return {
			severity: DiagnosticSeverity.Error,
			range: {
				start: Position.create(startRow - 1, startPos - 1),
				end: Position.create(endRow - 1, endPos)
			},
			message,
			source: 'kickass-studio'
		};
	}
}

documents.listen(connection);
connection.listen();
