import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, WorkspaceFolder } from 'vscode';
import {  getConfig } from '../helpers/extension';
import { canBeLaunched, getAllFilesByExtension } from '../helpers/pathHelper';
import { createTaskFileByDebugConfig, getBuildTaskName, hasTaskFile } from '../helpers/tasksHelper';


const createDebugLaunchConfig = (absFile) => {
	const config = getConfig();
	let cwd = vscode.workspace.rootPath;

	let relativeFile = path.relative(<string> cwd , <string>absFile);

	return 	({
			'type': 'kickassembler',
			'request': 'launch',
			'name': `Debug kickass ${relativeFile} file`,
			'program': path.join('${workspaceFolder}', relativeFile),
			'binDirectory': path.join('${workspaceFolder}', config.outputDir),
			'preLaunchTask': getBuildTaskName(absFile)
		});
};

const debugLaunchFileName = () =>  path.join(vscode.workspace.rootPath || '','.vscode/launch.json');

export const hasDebugLaunchFile = (): boolean => fs.existsSync(debugLaunchFileName());

const createDebugLaunchFile = (config) => {
	const taskFileContent = {
		'version': '2.0.0',
		'configurations': [config]
	};

	const debugLaunchFileName_  = debugLaunchFileName();

	if (!fs.existsSync(path.dirname(debugLaunchFileName_))){
		fs.mkdirSync(path.dirname(debugLaunchFileName_));
	}

	fs.writeFileSync(debugLaunchFileName_, JSON.stringify(taskFileContent, null, '\t'),  { flag: 'w'});
};


export class KickAssemblerDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

    async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
		return getAllFilesByExtension('.asm', folder?.uri.fsPath).filter(canBeLaunched).map(createDebugLaunchConfig);
	}


	// Esto se lanza siempre cuando existe el launch.json, el config viene configurado con eso.
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, debugConfig: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		const activeFile = vscode.window.activeTextEditor?.document.fileName;

		if (!debugConfig.name && canBeLaunched(activeFile)) {
			debugConfig = createDebugLaunchConfig(activeFile);
		}

		if (!hasTaskFile()){
			createTaskFileByDebugConfig(debugConfig);
		}

		if (!hasDebugLaunchFile()) {
			createDebugLaunchFile(debugConfig);
		}

		return debugConfig;
	}
}
