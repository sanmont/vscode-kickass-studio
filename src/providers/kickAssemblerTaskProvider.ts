import * as path from 'path';
import * as vscode from 'vscode';
import { CancellationToken, ProviderResult, Task } from 'vscode';
import { getBuildTaskName, getConfig } from '../helpers/extension';
import { canBeLaunched, instantiateJSONfileObject, isJSONFile } from '../helpers/pathHelper';


const createBuildTask = (f: string, name?) => {

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

export class KickAssemblerTaskProvider implements vscode.TaskProvider {
		provideTasks(token?: CancellationToken): ProviderResult<Task[]> {
			let workspaceRoot = vscode.workspace.rootPath;
			let emptyTasks: vscode.Task[] = [];
			if (!workspaceRoot) {
				return emptyTasks;
			}

			const activeFile = vscode.window.activeTextEditor?.document.fileName;

			let tasks: Task[] = [];

			if (canBeLaunched(activeFile)) {
				tasks = [createBuildTask(<string>activeFile)];
			}

			if (isJSONFile(<string>activeFile)) {
				const launch = instantiateJSONfileObject(activeFile);
				let launchConfig = (<[]>launch.configurations || []).filter(launchConfig =>
					(<string>((<any>launchConfig).preLaunchTask || '')).startsWith(getBuildTaskName()));

				if (launchConfig.length) {
					const { program } = launchConfig[0];
					const file = (<string>program).replace('${workspaceFolder}',workspaceRoot);
					tasks = [createBuildTask(<string>file)];
				}

			}

			return tasks;
		}

		resolveTask(task: Task, token?: CancellationToken): ProviderResult<Task> {
			return task;
		}
}
