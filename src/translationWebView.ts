import * as vscode from 'vscode';
import * as tools from "./xlfhelper";
import { XLIFFTranslator } from './XLIFFTranslator';
import { finished } from 'stream';

const xpath = require('xpath');
const xmldom = require('xmldom');

const globalXlfFilter = '**/*.g.xlf';
const transTag = 'trans-unit';

interface TranslationNode {
    id: String;
    source: String;
    target: String;
    description: String;
}

export class TranslationWebView {
    public static currentPanel: TranslationWebView | undefined;

    public static readonly viewType = 'translation';

    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private transXlfFilter = '**/*.' + vscode.workspace.getConfiguration().get('snc.translation.language') + '.xlf';
  
    public static createOrShow() {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;       

		// If we already have a panel, show it.
		if (TranslationWebView.currentPanel) {
			TranslationWebView.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			TranslationWebView.viewType,
			'Translation',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
                enableScripts: true,
                retainContextWhenHidden: true
			}
		);

		TranslationWebView.currentPanel = new TranslationWebView(panel);
    }
    
    public static revive(panel: vscode.WebviewPanel) {
		TranslationWebView.currentPanel = new TranslationWebView(panel);
	}

    private constructor(panel: vscode.WebviewPanel) {
        this._panel = panel;        
        
        this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					this._update();
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
                var translatedOnes: TranslationNode[] = [];
				for (let i=0;i<message.length;i++) {
                    if (message[i].target !== '') {
                        translatedOnes.push(message[i]);
                    }
                }
                this.InsertTranslations(translatedOnes);                    
			},
			null,
			this._disposables
		);
    }

    private _update() {
        this._panel.title = 'Translations';
        var dom = '';       

        var translationList: TranslationNode[] = [];
        var maxTranlations = Number(vscode.workspace.getConfiguration().get('snc.max.translations'));
        var useTranslator = vscode.workspace.getConfiguration().get('snc.use.azure.translator');
        var translatorSource: string = '[\n';
        var separator = '';
        vscode.workspace.findFiles(this.transXlfFilter,globalXlfFilter).then((uri) =>
        {     
            uri.forEach(uriElement => {
                
                var translationPath = uriElement.fsPath;
                var translationXLF = tools.openAndParseXlf(translationPath);
                var translatioNodes = translationXLF.getElementsByTagName(transTag);   
                if (!translatioNodes){
                    vscode.window.showInformationMessage('nothing to translate');
                    this.dispose();
                }

                for (let i=0; i < translatioNodes.length; i++) {
                    if (translatioNodes[i].getElementsByTagName('target')[0].textContent === ''){
                        var translation = {
                            id: translatioNodes[i].getAttribute('id'),
                            source: translatioNodes[i].getElementsByTagName('source')[0].textContent,
                            target: "",
                            description: translatioNodes[i].getElementsByTagName('note')[1].textContent
                        }; 
                        // source for translator
                        translatorSource += separator + '{\"Text\":\"' + translation.source + '\"}';
                        separator = ',\n';
                        
                        translationList.push(translation);
                        if (translationList.length >= maxTranlations) {
                            break;
                        }
                    }
                }
                if (useTranslator) {
                    translatorSource += "\n]";
                    var Translator = new XLIFFTranslator;
                    Translator.translate(translationXLF.getElementsByTagName('file')[0].getAttribute('target-language'),translatorSource).then((jsonResponse) =>{
                        for (let i=0;i<jsonResponse.length;i++) {
                            translationList[i].target = jsonResponse[i]['translations'][0]['text'];
                        }
                        translationList.forEach(node => {
                            this.createDom(dom,translationList);              
                        });                   
                    });            
                }else{
                    this.createDom(dom,translationList);
                }
            });           
        });        
    }

    private createDom(dom:string, translationList:TranslationNode[]){
        dom = `<!DOCTYPE html>
        <html lang="en">
        <head>
        </head>
        <style>
        body {
            margin: 0;
          }
          
          label {
            margin: 2px;
            font-size: 15px;
          }
          input {
            margin: 2px;
            margin-bottom: 8px;
            width: calc(100% - 14px);
            border: solid black 1px;
            border-radius: 3px;
            padding: 3px;
            font-size: 15px;
          }
          
          button {
            margin: 2px;
            background-color: #B21929;
            border: none;
            color: white;
            padding: 15px 20px;
            text-align: center;
            text-decoration: none;
            display: inline-block;
            font-size: 18px;
          }
        </style>
        <body>
            <h1 id="lines-of-code-counter">Translations</h1>
            <form>`;

        translationList.forEach(node => {
            dom += `<label><b>${node.source}</b>  (${node.description})<br> 
                    <input id="${node.id}" type="text" value="${node.target}"><br>`;                
        });

        dom += `<button type="button" onclick="sendTranslations()">Insert</button></form>
            </body>
            <script>`;

        dom += `
            const vscode = acquireVsCodeApi();

            function sendTranslations(){
            var translations = [];
            inputs = document.getElementsByTagName('input');
            for (let i=0;i<inputs.length;i++){
                var translation = {
                    id: inputs[i].id,
                    source: '',
                    target: inputs[i].value,
                    description: ''
                };
                translations.push(translation); 
            }
            vscode.postMessage(translations);
        }`;

        dom += `</script></html>`;    
        this._panel.webview.html = dom;
    }

    public InsertTranslations(translations: TranslationNode[]) {
        const transXlfFilter = '**/*.' + vscode.workspace.getConfiguration().get('snc.translation.language') + '.xlf';
        vscode.workspace.findFiles(transXlfFilter,globalXlfFilter).then((uri) =>
        {     
            uri.forEach(uriElement => {
                var translationPath = uriElement.fsPath;
                var translationXLF = tools.openAndParseXlf(translationPath);
                var translatioNodes = translationXLF.getElementsByTagName(transTag);             
                for (let i=0; i < translatioNodes.length; i++) {
                    let matchingNode = translations.find(e => e.id === translatioNodes[i].getAttribute('id'));
                    if (matchingNode) {
                        translatioNodes[i].getElementsByTagName('target')[0].textContent = matchingNode.target;
                    }
                }
                tools.writeXLFtoFile(translationXLF,translationPath);
                vscode.window.showInformationMessage('Translations have been inserted.');
                this._update();
            });
        });
    }    
    
    public dispose() {
		TranslationWebView.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
    }        
}