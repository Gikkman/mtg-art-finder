import fs from "fs";
import fsa from "fs/promises";
import readline from "readline";
import path from "path";
import https from "https";
import stream from 'stream';
import os from 'os';
import { Card, Cards } from 'scryfall-api';
import { ensureProperty, readProperties } from "./properties";
import { configureLogger, Logger } from "./logger";

const cwd = process.cwd();
const missingCards = new Array<string>();

type Properties = {inputFilePath: string, outputFolderPath: string};

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
    const regex = /^(?:[0-9]*[x]?)?[\s]?(?:t:)?([\w+',.\- !]+)\(?(\w{0,6})\)?/g;
    const matches = regex.exec(line);
    if(!matches) return;

    const cardName = matches[1].trim();
    const setCode = matches[2].trim();
    let query: string;
    if(setCode) {
        Logger.info(`Downloading card: ${cardName} (${setCode})`);
        query = `!"${cardName}" set:${setCode}`;
    }
    else {
        Logger.info(`Downloading card: ${cardName}`);
        query = `!"${cardName}"`;
    }

    const cards = await findAndSortCards(query);
    if(cards.length === 0) {
        Logger.error("No cards found for query: " + query)
        missingCards.push(cardName + (setCode ? `(${setCode})` : ""));
        return;
    }

    const winner = cards[0];
    const downloadLocation = path.join(properties.outputFolderPath, `${winner.name}.jpg`);
    const downloadUri = winner.image_uris?.art_crop;
    if(downloadUri === undefined || downloadUri.length === 0) {
        Logger.error(`No cards with art_crop found for query '${query}'`);
        return;
    }
    downloadImageToUrl(downloadUri, downloadLocation);
}

async function findAndSortCards(query: string) {
    const cards = new Array<Card>();
    const cardPages = Cards.search(query);

    while( cardPages.hasMore ) {
        let page = await cardPages.next();
        for(const card of page) {
            if(!card.image_uris?.art_crop) {
                continue;
            }
            cards.push(card);
        }
    }

    cards.sort( (a:Card,b:Card) => {
        // Prefer those with art_crop
        if(a.image_uris?.art_crop && !b.image_uris?.art_crop) return 1;
        if(!a.image_uris?.art_crop && b.image_uris?.art_crop) return -1;
        // Prefer non-textless
        if(a.textless && !b.textless) return -1;
        if(!a.textless && b.textless) return 1;
        // Prefer non-promo
        if(a.promo && !b.promo) return -1;
        if(!a.promo && b.promo) return 1;
        // Prefer non-fullart
        if(a.full_art && !b.full_art) return -1;
        if(!a.full_art && b.full_art) return 1;
        // Prefer non-variation
        if(a.variation && !b.variation) return -1;
        if(!a.variation && b.variation) return 1;
        // Prefer highres images
        if(a.highres_image && !b.highres_image) return 1;
        if(!a.highres_image && b.highres_image) return -1;
        // Prefer the newest
        if(a.released_at > b.released_at) return 1;
        if(a.released_at < b.released_at) return -1;
        return 0;
    })
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