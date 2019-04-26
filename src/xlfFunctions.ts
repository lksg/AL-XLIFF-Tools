import * as vscode from 'vscode';
import * as tools from "./xlfhelper";
import * as fs from 'fs';

const globalXlfFilter = '**/*.g.xlf';
const transTag = 'trans-unit';

export function CreateNewTranslationNodes(){
    console.log('Starting to creating new empty nodes in translation files.');
    var newNodesCount = 0;
    const transXlfFilter = '**/*.' + vscode.workspace.getConfiguration().get('snc.translation.language') + '.xlf';

    vscode.workspace.findFiles(globalXlfFilter).then((uri) =>{
        var globalXlf = tools.openAndParseXlf(uri[0].fsPath);
        var translatables = globalXlf.getElementsByTagName(transTag);
        
        vscode.workspace.findFiles(transXlfFilter,globalXlfFilter).then((uri2) =>
        {     
            uri2.forEach(uriElement => {
                var translationPath = uriElement.fsPath;
                var translationXLF = tools.openAndParseXlf(translationPath);
                var translatioNodes = translationXLF.getElementsByTagName(transTag);
                // Huge performance benefit
                var translationNodeList = tools.getExistingNodeIDsList(translatioNodes);
                for (let i=0; i < translatables.length; i++) {
                    if (!translationNodeList.includes(translatables[i].getAttribute('id'))) {
                        newNodesCount++;
                        var targetNode = translationXLF.createElement("target");
                        var newtext = translationXLF.createTextNode('');
                        targetNode.appendChild(newtext);
                        var noteNode = translatables[i].getElementsByTagName('note')[0];
                        noteNode.insertBefore(targetNode, noteNode);
                        translationXLF.getElementsByTagName('group')[0].appendChild(translatables[i]);
                        i--;
                    }   
                }
                // Wrap up and write to file
                tools.writeXLFtoFile(translationXLF,translationPath);
                vscode.window.showInformationMessage('Done. New Nodes: ' + newNodesCount);
            });         
        });        
    });  
}

export function RemoveLegacyNodes(){
    console.log('Starting to remove nodes with no corresponding global translations.');
    var newNodesCount = 0;
    const transXlfFilter = '**/*.' + vscode.workspace.getConfiguration().get('snc.translation.language') + '.xlf';

    vscode.workspace.findFiles(globalXlfFilter).then((uri) =>{
        var globalXlf = tools.openAndParseXlf(uri[0].fsPath);
        var translatables = globalXlf.getElementsByTagName(transTag);
        var globalNodeList = tools.getExistingNodeIDsList(translatables);

        vscode.workspace.findFiles(transXlfFilter,globalXlfFilter).then((uri2) =>
        {     
            uri2.forEach(uriElement => {
                var translationPath = uriElement.fsPath;
                
                var translationXLF = tools.openAndParseXlf(translationPath);
                var translatioNodes = translationXLF.getElementsByTagName(transTag);
                
                for (let i=0; i < translatioNodes.length; i++) {
                    if (!globalNodeList.includes(translatioNodes[i].getAttribute('id'))){
                        newNodesCount++;
                        translatioNodes[i].parentNode.removeChild(translatioNodes[i]);
                        i--;
                    }   
                }
                // Wrap up and write to file
                tools.writeXLFtoFile(translationXLF,translationPath);
                console.log('Done. Removed Nodes: ' + newNodesCount);   
            });         
        });        
    });
}

export function bestEffortFix(){
    console.log('Starting to match nodes with no translation with nodes with no source.');
    var newNodesCount = 0;
    var renamed: string[] = [];
    const transXlfFilter = '**/*.' + vscode.workspace.getConfiguration().get('snc.translation.language') + '.xlf';

    vscode.workspace.findFiles(globalXlfFilter).then((uri) =>{
        var globalXlf = tools.openAndParseXlf(uri[0].fsPath);
        var translatables = globalXlf.getElementsByTagName(transTag);
        
        vscode.workspace.findFiles(transXlfFilter,globalXlfFilter).then((uri2) =>
        {     
            uri2.forEach(uriElement => {
                var translationPath = uriElement.fsPath;
                var translationXLF = tools.openAndParseXlf(translationPath);
                var translatioNodes = translationXLF.getElementsByTagName(transTag);
                // Huge performance benefit
                var translationNodeList = tools.getExistingNodeIDsList(translatioNodes);
                var translatablesNodeList = tools.getExistingNodeIDsList(translatables);
                for (let i=0; i < translatables.length; i++) {
                    if (!translationNodeList.includes(translatables[i].getAttribute('id')) && !renamed.includes(translatables[i].getAttribute('id'))) {
                        for (let j=0; j < translatioNodes.length; j++){
                            if (translatablesNodeList.includes(translatioNodes[j].getAttribute('id'))){
                               continue; 
                            }
                            var translatablesSplit = translatables[i].getAttribute('id').split('-');
                            var translationSplit = translatioNodes[j].getAttribute('id').split('-');
                            if ( translatablesSplit.length !== translationSplit.length){
                                continue;
                            }
                            var IdnotMatched = false;
                            for (let k=1; k<translatablesSplit.length; k++){
                                if (translatablesSplit[k] !== translationSplit[k]){
                                    IdnotMatched = true;
                                }
                            }
                            if (IdnotMatched){
                                continue;
                            }
                            if (translatablesSplit[0].split(' ')[0] !== translationSplit[0].split(' ')[0]){
                                continue;
                            }
                            if (translatables[i].getElementsByTagName('source').textContent !== translatioNodes[j].getElementsByTagName('source').textContent){
                                continue;
                            } 
                            newNodesCount++;
                            console.log(translatioNodes[j].getAttribute('id') + ' ==> ' + translatables[i].getAttribute('id'));
                            translatioNodes[j].setAttribute('id',translatables[i].getAttribute('id'));
                            // fix note node if name changed this is helpful
                            translatioNodes[j].getElementsByTagName('note')[1].textContent = translatables[i].getElementsByTagName('note')[1].textContent;
                            renamed.push(translatables[i].getAttribute('id'));
                        }
                    }   
                }
                // Wrap up and write to file
                tools.writeXLFtoFile(translationXLF,translationPath);
                console.log('Done. Nodes fixed: ' + newNodesCount);   
            });         
        });        
    });  
}

export async function SetTranslationLanguage() {
    var languageShorthand = vscode.workspace.getConfiguration().get('snc.translation.language');

    languageShorthand = await vscode.window.showInputBox({ prompt: 'Enter translation language shorthand', value: `${languageShorthand}` });

    await vscode.workspace.getConfiguration().update('snc.translation.language', languageShorthand);	
}

export async function InitTranslationFile() {
    if (vscode.workspace.getConfiguration().get('snc.translation.language') === '') {
        await SetTranslationLanguage();
    }   
    const transXlfFilter = '**/*.' + vscode.workspace.getConfiguration().get('snc.translation.language') + '.xlf'; 

    var targetLanguage = await vscode.window.showInputBox({ prompt: 'Enter target-language Examples: de-DE, en-US, fr-FR', value: '' });
    var languageShorthand = vscode.workspace.getConfiguration().get('snc.translation.language');

    vscode.workspace.findFiles(globalXlfFilter).then((uri) =>{
        var newFilePath = uri[0].fsPath.toString().replace('g.xlf',languageShorthand+'.xlf');
        if (fs.existsSync(newFilePath)) {
            vscode.window.showErrorMessage('File exists already: ' + newFilePath);
            return;
        }
        fs.copyFileSync(uri[0].fsPath,newFilePath);

        console.log(targetLanguage);

        var translationXLF = tools.openAndParseXlf(newFilePath);       
        translationXLF.getElementsByTagName('file')[0].setAttribute('target-language',targetLanguage);

        var translatioNodes = translationXLF.getElementsByTagName(transTag);
        for (let i=0; i < translatioNodes.length; i++) {
            var targetNode = translationXLF.createElement("target");
            var newtext = translationXLF.createTextNode('');
            targetNode.appendChild(newtext);
            var noteNode = translatioNodes[i].getElementsByTagName('note')[0];
            noteNode.insertBefore(targetNode, noteNode);
        }
        tools.writeXLFtoFile(translationXLF,newFilePath);
    });    
}