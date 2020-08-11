'use strict';

import * as vscode from 'vscode';
import { ProviderResult } from 'vscode';
import { KickAssemblerDebugSession } from './kickAssemblerDebug';
import * as hoverProvider from './languageClient/client/helpTexts/hoverProvider';
import * as LanguageClient from './languageClient/client/languageClient';
import { KickAssemblerDebugConfigurationProvider } from './providers/kickAssemblerDebugConfigurationProvider';
import { KickAssemblerTaskProvider } from './providers/kickAssemblerTaskProvider';
import { getConfig } from './helpers/extension';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { normalize } from 'path';


export function activate(context: vscode.ExtensionContext) {
	const config  = getConfig();
	var a  = normalize('c:\\windows');
	var b  = normalize('C:\\windows');


	const proc = spawn(config.javaBin);
	proc.on('error', (e) => {
		vscode.window.showErrorMessage("Java not found. Check the extension configuration.");
	})

	if(!existsSync(config.kickAssJar)) {
		vscode.window.showErrorMessage("Kick Assembler not found. Check the extension configuration.");
	}

	const client = LanguageClient.create(context);
	client.start();

	context.subscriptions.push(vscode.languages.registerHoverProvider({ scheme: '*', language: 'kickassembler'}, hoverProvider));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('kickassembler', new KickAssemblerDebugConfigurationProvider()));
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('kickassembler', new InlineDebugAdapterFactory()));
	context.subscriptions.push(vscode.tasks.registerTaskProvider('kickassembler', new KickAssemblerTaskProvider()));
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {
	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new KickAssemblerDebugSession());
	}
}
