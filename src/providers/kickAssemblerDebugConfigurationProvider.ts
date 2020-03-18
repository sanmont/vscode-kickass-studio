import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode';
import { createDebugLaunchConfig, createDebugLaunchFile, hasDebugLaunchFile } from '../helpers/debugConfigurationHelper';
import { canBeLaunched, getAllFilesByExtension } from '../helpers/pathHelper';
import { createTaskFileByDebugConfig, hasTaskFile } from '../helpers/tasksHelper';

export class KickAssemblerDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

	async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
		return getAllFilesByExtension('.asm', folder?.uri.fsPath).filter(canBeLaunched).map(createDebugLaunchConfig);
	}

	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfig: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		const activeFile = vscode.window.activeTextEditor?.document.fileName;

		if (!debugConfig.name && canBeLaunched(activeFile)) {
			debugConfig = createDebugLaunchConfig(activeFile);
		}

		if (!hasTaskFile()) {
			createTaskFileByDebugConfig(debugConfig);
		}

		if (!hasDebugLaunchFile()) {
			createDebugLaunchFile(debugConfig);
		}

		return debugConfig;
	}
}
