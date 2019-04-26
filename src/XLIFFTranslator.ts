import * as vscode from 'vscode';
import * as fs from 'fs';
import * as util from 'util';
import * as xmldom from 'xmldom';
import * as httpm from 'typed-rest-client/HttpClient';
import * as trc from 'typed-rest-client/Interfaces';

export class XLIFFTranslator {

    private static readonly writeFile = util.promisify(fs.writeFile);
    private static readonly readFile = util.promisify(fs.readFile);
    private translationServiceApiKey: string | undefined;

    // Translate the XLIFF files in the workspace
    async translate(targetLanguage: string, sources: string): Promise<any> {
        this.translationServiceApiKey = await this.getTranslationServiceApiKey();

        if (util.isUndefined(this.translationServiceApiKey)) {
            console.log("Invalid translation service api key");
            vscode.window.showErrorMessage('Invalid translation service api key');
            return;
        }   
      
        // Issue the REST call to the translation service
        const url = 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&category=f8e60695-29f5-4f76-825b-7d463d301c17-BUSINES&from=en&to=' + targetLanguage;
        var headers: trc.IHeaders = {};
        headers['Content-Type'] = 'application/json';
        headers['Ocp-Apim-Subscription-Key'] = this.translationServiceApiKey;
        var client = new httpm.HttpClient('xliffTranslator');
        var response = await client.post(url, sources, headers);
       
        // Handle the response
        var responseBody = await response.readBody();
        var jsonResponse = this.handleResponse(responseBody);
        if (util.isUndefined(jsonResponse)) {
            return;
        }
        return jsonResponse;
    }

    // Retrieve the translation service api key
    private async getTranslationServiceApiKey(): Promise<string | undefined> {
        if (!util.isUndefined(this.translationServiceApiKey)) {
            return this.translationServiceApiKey;
        }

        // Try to get the key from the configuration
        const key = vscode.workspace.getConfiguration().get<string>('snc.azure.translator.apikey');
        if (!util.isUndefined(key)) {
            return key;
        }

        // Ask the user for the key
        const result = await vscode.window.showInputBox({prompt: 'Enter the Translation Service API key'}        );

        if (!util.isUndefined(result) && result.length === 0) {
            return undefined;
        }

        await vscode.workspace.getConfiguration().update('snc.azure.translator.apikey', result);	
        return result;
    }

    // Parse the reponse body and handle possible errors
    // retuns the parsed JSON response if no errors or undefined otherwise
    private handleResponse(responseBody: string): any | undefined {
        console.log('Response:\n' + responseBody);

        var jsonResponse: any;
        try {
            jsonResponse = JSON.parse(responseBody);

        } catch (error) {
            console.log('Error parsing JSON response: \n' + responseBody);
            return undefined;
        }

        if (!util.isNullOrUndefined(jsonResponse['error'])) {
            console.log('Error calling the translation service:');
            console.log(jsonResponse['error']['message']);
            vscode.window.showErrorMessage('Error calling the translation service: ' + jsonResponse['error']['message']);
            
            // Error 401000 indicates wrong credentials in which case the api key is most
            // likely invalid. Resetting the api key, so the user gets prompt again for it.
            if (jsonResponse['error']['code'] === 401000) {
                this.translationServiceApiKey = undefined;
            }

            return undefined;
        }

       return jsonResponse;
    }
}