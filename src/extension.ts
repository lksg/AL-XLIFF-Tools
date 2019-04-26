import * as vscode from 'vscode';
import * as xlfFunctions from "./xlfFunctions";
import { TranslationWebView } from "./translationWebView";

export function activate(context: vscode.ExtensionContext) {

	let commandlist= [
		vscode.commands.registerCommand('snc.createnewnodes', xlfFunctions.CreateNewTranslationNodes),
		vscode.commands.registerCommand('snc.removelegacynodes', xlfFunctions.CreateNewTranslationNodes),
		vscode.commands.registerCommand('snc.translateall', TranslationWebView.createOrShow),
		vscode.commands.registerCommand('snc.fixtranslationnodes', xlfFunctions.bestEffortFix),
		vscode.commands.registerCommand('snc.settranslationlanguage', xlfFunctions.SetTranslationLanguage),
		vscode.commands.registerCommand('snc.inittranslationfile', xlfFunctions.InitTranslationFile)
	];

	context.subscriptions.concat(commandlist);
}

export function deactivate() {}
