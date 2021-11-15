import fs from "fs";
import fsa from "fs/promises";
import readline from "readline";
import path from "path";
import https from "https";
import stream from 'stream';
import os from 'os';
import { Cards } from 'scryfall-api';
import { ensureProperty, readProperties } from "./properties";
import { configureLogger, Logger } from "./logger";

const cwd = process.cwd();
const missingCards = new Array<string>();

type Properties = {inputFilePath: string, outputFolderPath: string};
type CardData = {artist: string, set: string, name: string, image_uri?: string}
async function main() {
    const props = readProperties("mtg-art-finder.properties");
    configureLogger(props.get("app.log-level")?.toString());

    const inputFile = ensureProperty("input.cards", props);
    const outputFolder = ensureProperty("output.folder", props);

    const inputFilePath = path.join(cwd, inputFile);
    if(!fs.existsSync(inputFilePath)) {
        throw "No file found at input file path " + inputFilePath;
    }

    const outputFolderPath = path.join(cwd, outputFolder);
    if(!fs.existsSync(outputFolderPath)) {
        Logger.debug("No directory for output found. Creating it at " + outputFolderPath);
        fs.mkdirSync(outputFolderPath);
    }

    return {inputFilePath, outputFolderPath};
}

async function doit(properties: Properties) {
    const rl = readline.createInterface({
        input: fs.createReadStream( properties.inputFilePath ),
    });
    for await (const line of rl) {
        if(line.trim().length === 0) continue;
        await processCardLine(line, properties);
        await sleep(50);
    }
    rl.close();
};

main()
.then(doit)
.then(() => {
    if(missingCards.length > 0) {
        const data = missingCards.join(os.EOL);
        console.error("----------------------------------------------")
        console.error("-- Some cards' art could not be found       --")
        console.error("-- A list is written to 'cards-missing.txt' --")
        console.error("----------------------------------------------")
        return fsa.writeFile( path.join(cwd, "cards-missing.txt"), data);
    }
})
.then(() => {
    console.log("Done");
})
.catch(e => {
    console.error(e);
});

async function processCardLine(line: string, properties: Properties) {
    // Regex explanation (with optional parts being withing [] brackets)
    // [Nx] [t:]CARD NAME [(SET CODE)]
    const regex = /^(?:[0-9]*[x]?)?[\s]?(\w:)?([\w+',.\- !]+)\(?(\w{0,6})\)?/g;
    const matches = regex.exec(line);
    if(!matches) return;

    const isToken = !!matches[1];
    const cardName = matches[2].trim();
    const setCode = matches[3].trim();
    let query: string;
    if(setCode) {
        Logger.info(`Downloading: ${cardName} (${setCode})`);
        query = `!"${cardName}" set:${setCode}`;
    }
    else {
        Logger.info(`Downloading: ${cardName}`);
        query = `!"${cardName}"`;
    }

    const cards = await findAndSortCards(query, isToken);
    if(cards.length === 0) {
        Logger.error("No cards found for query: " + query)
        missingCards.push(cardName + (setCode ? `(${setCode})` : ""));
        return;
    }

    for( const card of cards) {
        const downloadLocation = path.join(properties.outputFolderPath, `${card.name} (${card.artist}).jpg`);
        const downloadUri = card.image_uri;
        if(downloadUri === undefined || downloadUri.length === 0)
            Logger.error(`No art found for card '${card.name} (${card.set}) [Query was ${query}]'`);
        else
            downloadImageToUrl(downloadUri, downloadLocation);
    }
}

async function findAndSortCards(query: string, isToken: boolean) {
    const cards = new Array<CardData>();
    const cardPages = Cards.search(query, {include_extras: isToken});
    let page = await cardPages.next();

    for(const card of page) {
        const faces = card.card_faces ? card.card_faces : [card]
        for(const face of faces ) {
            const name = face.name;
            const artist = face.artist ?? 'UNKNOWN';
            const set = card.set;
            const image_uri = face.image_uris?.art_crop;
            cards.push( {name, artist, set, image_uri});
        }
    }

    return cards;
} 

function downloadImageToUrl(url: string, filename: string) { 
    https.get(url, (response) => {
        const data = new stream.Transform();

        response.on('data', function(chunk) {
            data.push(chunk);
        });

        response.on('end', function() {
            Logger.debug("Image downloaded. Writing to ", filename)
            fs.writeFile(filename, data.read(),  (err) => {
                if(err) Logger.error("Error saving file " + filename, err);
            });
        });
   }).end()
};

function sleep(ms:number): Promise<unknown> {
    return new Promise(res => {
        setTimeout(() => {
            res('');
        }, ms);
    })
};