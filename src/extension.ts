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
import * as commandExists from 'command-exists';


export async function activate(context: vscode.ExtensionContext) {
	const config  = getConfig();

	try {
		await commandExists(config.viceBin)
	} catch(e) {
		vscode.window.showErrorMessage("Java not found. Check the extension configuration.");
	}

	if(!existsSync(config.kickAssJar)) {
		await vscode.window.showErrorMessage("Kick Assembler not found. Select kickass.jar.");
		const selected = await vscode.window.showOpenDialog({filters: {"Java archive (JAR) ": ['jar']}});
		if (selected) {
			config.update('kickAssJar', selected[0].fsPath , vscode.ConfigurationTarget.Global);
		} else {
			vscode.window.showInformationMessage('Change the configuration manually');
		}
	}


	try {
		await commandExists(config.viceBin)
	} catch(e) {
		await vscode.window.showErrorMessage("Vice not found. Select executable vice file.");
		const selected = await vscode.window.showOpenDialog();
		if (selected) {
			config.update('viceBin', selected[0].fsPath , vscode.ConfigurationTarget.Global);
		} else {
			vscode.window.showInformationMessage('Change the configuration manually');
		}
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
