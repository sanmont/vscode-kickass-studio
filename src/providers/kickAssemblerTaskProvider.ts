import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, Task } from 'vscode';
import { canBeLaunched } from '../helpers/pathHelper';
import { createBuildTask } from '../helpers/tasksHelper';

export class KickAssemblerTaskProvider implements vscode.TaskProvider {
		async provideTasks(token?: CancellationToken): Promise<ProviderResult<Task[]>> {
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

			return tasks;
		}

		resolveTask(task: Task, token?: CancellationToken): ProviderResult<Task> {
			return task;
		}
}