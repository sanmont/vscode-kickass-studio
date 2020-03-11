import * as vscode from 'vscode';
import * as path from 'path';


interface IKickConfig {
	outputDir: string;
	kickAssJar: string;
	javaBin: string;
	viceBin: string;
	useC64Debugger: boolean;
	c64DebuggerBin: string;
	emptyBinFolderBeforeBuild: string;
 };

export const getConfig = (): IKickConfig => <IKickConfig> <unknown> vscode.workspace.getConfiguration('kickass-studio');

export const getBuildTaskName = (filename?) => {
	let file = '';

	if (filename) {
		const cwd = vscode.workspace.rootPath || '';
		file = path.relative(cwd , filename);
	}

	return 'Build kickass ' + file;
}