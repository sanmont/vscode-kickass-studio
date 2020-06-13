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

export function activate(context: vscode.ExtensionContext) {
	const config  = getConfig();
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
