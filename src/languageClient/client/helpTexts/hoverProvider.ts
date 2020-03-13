'use strict';
import * as vscode from 'vscode';
import * as illegal_opcodes from './illegal-opcodes.json';
import * as kickass from './kickass.json';
import opcodes from './opcodes';
import * as sid_registers from './sid-registers.json';
import * as vic_registers from './vic-registers.json';

const helpTexts = {
  ...opcodes,
	...illegal_opcodes,
	...kickass,
	...sid_registers,
	...vic_registers
};

const provideHover = (document, position) => {
	const word = document.getText(document.getWordRangeAtPosition(position, /[#.:\w$]+/));
	const helpText = helpTexts[word.toLowerCase()];
	if (!helpText) return null;

	const markdown = new vscode.MarkdownString();
	markdown.appendCodeblock(helpText.name, 'kickassembler');
	markdown.appendMarkdown(helpText.descr);
	return new vscode.Hover(markdown);
};

export { provideHover };
