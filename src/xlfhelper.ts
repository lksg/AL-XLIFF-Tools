import * as vscode from 'vscode';
import * as fs from 'fs';
import * as vkbeautify from 'vkbeautify';

const xmldom = require('xmldom');

export function getXlfPath(filter: string){
    return(vscode.workspace.findFiles(filter));
}

export function openAndParseXlf(xlfPath: string){
    var xlf = fs.readFileSync(xlfPath, "utf8");
    var DOMParser = xmldom.DOMParser;
    return new DOMParser().parseFromString(xlf);
}

export function getExistingNodeIDsList(nodes: any): Array<string>{
    var nodeList = [];    
    for (let i=0; i < nodes.length; i++) {
        nodeList.push(nodes[i].getAttribute('id'));
    }
    return nodeList;
}

export function getDialogOptions(objectType:string, objectName:string, translatableText:string): vscode.InputBoxOptions{
    let options: vscode.InputBoxOptions = {
        prompt: `In ${objectType} ${objectName} please translate: ${translatableText}`,
        placeHolder: ""
    };
    return options;
}

export function writeXLFtoFile(xlf: any, filePath: string){
    var serializer = new xmldom.XMLSerializer();
    var newFileStr = serializer.serializeToString(xlf);
    // make XLIFF more readable            
    // newFileStr = vkbeautify.xml(newFileStr);
    fs.writeFile(filePath, newFileStr,  function(err) {
        if (err) {
            return console.error(err);
        }
    });
}
