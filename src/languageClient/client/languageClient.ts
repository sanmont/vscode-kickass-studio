'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient';


export const create = (context) => {
	const server = {
		module: context.asAbsolutePath(path.join('out', 'languageClient', 'server.js')),
		transport: TransportKind.ipc
	};

	const serverOptions = {
		run: server,
		debug: {
			...server,
			options: { execArgv: ['--nolazy', '--inspect=3000'] }
		}
	};

	const clientOptions = {
		documentSelector: [{ scheme: 'file', language: 'kickassembler' }],
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	return new LanguageClient('kickAss', 'KickAss Language Server', serverOptions, clientOptions);
};

