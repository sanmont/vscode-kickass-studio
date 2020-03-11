import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { getConfig, getBuildTaskName } from '../helpers/extension';
import { canBeLaunched, isJSONFile, instantiateJSONfileObject } from '../helpers/pathHelper';


const defaultLaunch = (absFile) => {
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
}


const createLaunchConfig = (config ) => {
	let cwd = vscode.workspace.rootPath || '';

	let activeFile = vscode.window.activeTextEditor?.document.fileName;

	if (canBeLaunched(activeFile)) {
		config = defaultLaunch(activeFile);
	}

	if (isJSONFile(<string>activeFile)) {
		const task = instantiateJSONfileObject(activeFile);
		let buildConfig = (<[]>task.tasks || []).filter(launchConfig =>
			(<string>((<any>launchConfig).label || '')).startsWith(getBuildTaskName()));

		if (buildConfig.length) {
			const label:string =  (<any>buildConfig[0]).label;
			const fileName: string = path.join(cwd, label.replace(getBuildTaskName(), ''));
			config = defaultLaunch(fileName);
		}
	}

	return config;
};

export class KickAssemblerDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

    async provideDebugConfigurations(folder: vscode.WorkspaceFolder | undefined, token?: vscode.CancellationToken): Promise<vscode.DebugConfiguration[]> {
		let config = createLaunchConfig(null);
		return config? [config] : [];
	}

	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		return createLaunchConfig(config);
	}
}