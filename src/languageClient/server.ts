'use strict';

import * as path from 'path';

import { Location } from
	'vscode-languageclient';
import {
	createConnection,
	Diagnostic,
	DiagnosticSeverity,
	DidChangeConfigurationNotification,
	ProposedFeatures,
	TextDocuments,
	TextDocumentChangeEvent,
	TextDocument,
} from 'vscode-languageserver';
import { ASMInfoAnalizer, ASMInfoError } from './kickassASMInfo';


const documentSettings = new Map();


const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments();
let globalSettings = {};

let hasConfigurationCapability = false;

const ASMAnalizer = new ASMInfoAnalizer();

connection.onInitialize(({ capabilities }) => {
	console.log("on initialize");

	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	return {
		capabilities: {
			textDocumentSync: documents.syncKind,
			definitionProvider: true,
			referencesProvider: true,
		}
	};
});

connection.onReferences(async param => {
	const { textDocument, position, context } = param;
	const word = ASMAnalizer.getWord(textDocument.uri, position);
	if (!word) return null;

	let locations: Location[] = [];

	if (context.includeDeclaration) {
		const loc = ASMAnalizer.getLabel(word);

		if (loc) {
			locations.push(loc);
		}
	}

	locations = locations.concat(ASMAnalizer.getSymbolReferences(word));

	return locations;
});

connection.onDefinition(({ textDocument, position }) => {
	const word = ASMAnalizer.getWord(textDocument.uri, position);
	if (!word) return null;

	const location = ASMAnalizer.getLabel(word) || ASMAnalizer.getDefinition(word);

	if (location) {
		return { uri: location.uri, range: location.range };
	}

	return null;
});

connection.onCodeLens

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		connection.client.register(DidChangeConfigurationNotification.type);
	}
});

documents.onDidOpen((change: TextDocumentChangeEvent) => {
	validateDocument(change.document);
});

documents.onDidChangeContent((change: TextDocumentChangeEvent) => {
	validateDocument(change.document);
});

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = change.settings['kickass-studio'];
	}

	documents.all().forEach(validateDocument);
});

function getDocumentSettings(resource) {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}

	let result = documentSettings.get(resource);

	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri:
				resource, section: 'kickass-studio'
		});
		documentSettings.set(resource, result);
	}

	return result;
}


async function validateDocument(document: TextDocument) {

	const settings = await getDocumentSettings(document.uri);

	await ASMAnalizer.analize(document, settings);

	const errors = ASMAnalizer.getErrors();

	connection.sendDiagnostics({
		uri: document.uri, diagnostics:
			toDiagnosticErrors(document.uri, errors)
	});
}

function toDiagnosticErrors(uri: string, errors: ASMInfoError[]): Diagnostic[] {
	return errors.filter(({ location }) => location.uri === uri)
		.map(({ message, location }) =>
			Diagnostic.create(
				location.range,
				message,
				DiagnosticSeverity.Error,
				undefined,
				'kickass-studio'
				)
			);
}

documents.listen(connection);
connection.listen();