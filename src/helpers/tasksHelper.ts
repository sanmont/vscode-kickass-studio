import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { DebugConfiguration } from 'vscode';
import { getConfig } from '../helpers/extension';

export const getBuildTaskName = (filename?) => {
	let file = '';

	if (filename) {
		const cwd = vscode.workspace.rootPath || '';
		file = path.relative(cwd , filename);
	}

	return 'Build kickass ' + file;
};

const tasksFileName = () => path.join(vscode.workspace.rootPath || '','.vscode/tasks.json');

export const hasTaskFile = (): boolean => fs.existsSync(tasksFileName());

export const createTaskFileByDebugConfig = (debugConfig: DebugConfiguration) => {
	const { program } = debugConfig;
	const workspaceRoot = <string> vscode.workspace.rootPath;
	const launchFile = (<string>program).replace('${workspaceFolder}',workspaceRoot);
	const task = createBuildTask(launchFile);

	const taskFileContent = {
		'version': '2.0.0',
		'tasks': [task.definition]
	};

	const taskFileName_  = tasksFileName();

	if (!fs.existsSync(path.dirname(taskFileName_))){
		fs.mkdirSync(path.dirname(taskFileName_));
	}

	fs.writeFileSync(taskFileName_, JSON.stringify(taskFileContent, null, '\t'),  { flag: 'w'});
};


export const createBuildTask = (f: string, name?) => {

	const cwd = vscode.workspace.rootPath || '';
	const config = getConfig();

	const file = !f.startsWith('${') ? path.relative(cwd , f) : f;
	const args = ['-jar', config.kickAssJar,
				'-odir', config.outputDir,
				'-log', 'buildlog.txt',
				'-showmem', '-debugdump', '-vicesymbols',
				file] ;


	name = typeof name !== 'string' ? getBuildTaskName(f) : name;


	const command: vscode.ShellExecution = new vscode.ShellExecution(config.javaBin, args, { cwd });

	let definition: vscode.TaskDefinition = {
		type: 'shell',
		label: name,
		command: config.javaBin,
		args,
		options: { cwd: '${workspaceFolder}' },
	};

	const task = new vscode.Task(definition , vscode.TaskScope.Workspace, name, 'kickass-studio', command, ['$kickass','$kickass.single']);
	task.group = vscode.TaskGroup.Build;
	task.definition = definition;

	return task;
};

