import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { getConfig } from './extension';
import { getBuildTaskName } from './tasksHelper';

export const createDebugLaunchConfig = (absFile) => {
	const config = getConfig();
	let cwd = vscode.workspace.rootPath;

	let relativeFile = path.relative(<string>cwd, <string>absFile);

	return ({
		'type': 'kickassembler',
		'request': 'launch',
		'name': `Debug kickass ${relativeFile} file`,
		'program': path.join('${workspaceFolder}', relativeFile),
		'binDirectory': path.join('${workspaceFolder}', config.outputDir),
		'preLaunchTask': getBuildTaskName(absFile)
	});
};

export const debugLaunchFileName = () => path.join(vscode.workspace.rootPath || '', '.vscode/launch.json');

export const hasDebugLaunchFile = (): boolean => fs.existsSync(debugLaunchFileName());

export const createDebugLaunchFile = (config) => {
	const taskFileContent = {
		'version': '2.0.0',
		'configurations': [config]
	};

	const debugLaunchFileName_ = debugLaunchFileName();

	if (!fs.existsSync(path.dirname(debugLaunchFileName_))) {
		fs.mkdirSync(path.dirname(debugLaunchFileName_));
	}

	fs.writeFileSync(debugLaunchFileName_, JSON.stringify(taskFileContent, null, '\t'), { flag: 'w' });
};