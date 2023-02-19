import * as path from 'path';
import * as vscode from 'vscode';


export interface IKickConfig extends vscode.WorkspaceConfiguration {
	outputDir: string;
	kickAssJar: string;
	javaBin: string;
	viceBin: string;
	useC64Debugger: boolean;
	c64DebuggerBin: string;
	emptyBinFolderBeforeBuild: string;
 }

export const getConfig = (): IKickConfig => vscode.workspace.getConfiguration('kickass-studio') as IKickConfig;