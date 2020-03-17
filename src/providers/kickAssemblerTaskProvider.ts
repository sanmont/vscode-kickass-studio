import * as vscode from 'vscode';
import { CancellationToken, DebugConfiguration, ProviderResult, Task } from 'vscode';
import { canBeLaunched, getAllFilesByExtension } from '../helpers/pathHelper';
import { createBuildTask } from '../helpers/tasksHelper';

export class KickAssemblerTaskProvider implements vscode.TaskProvider {
		async provideTasks(token?: CancellationToken): Promise<ProviderResult<Task[]>> {
			let workspaceRoot = vscode.workspace.rootPath;
			let emptyTasks: vscode.Task[] = [];
			if (!workspaceRoot) {
				return emptyTasks;
			}

			return getAllFilesByExtension('.asm', workspaceRoot).filter(canBeLaunched).map(createBuildTask);
		}

		resolveTask(task: Task, token?: CancellationToken): ProviderResult<Task> {
			return task;
		}
}