'use strict';

import * as vscode from 'vscode';
import * as hoverProvider from './languageClient/client/helpTexts/hoverProvider';
import { ProviderResult } from 'vscode';
import { KickAssemblerDebugSession } from './kickAssemblerDebug';
import { KickAssemblerDebugConfigurationProvider } from './providers/kickAssemblerDebugConfigurationProvider';
import { KickAssemblerTaskProvider } from './providers/kickAssemblerTaskProvider';


export function activate(context: vscode.ExtensionContext) {
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
