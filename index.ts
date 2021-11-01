import fs from "fs";
import readline from "readline";
import path from "path";
import https from "https";
import stream from 'stream';
import { Card, Cards } from 'scryfall-api';

const cwd = process.cwd();
const artFolderPath = path.join(cwd, "art");

async function doit() {
    if( !fs.existsSync( artFolderPath )) {
        fs.mkdirSync( artFolderPath );
    }
    const rl = readline.createInterface({
        input: fs.createReadStream( path.join(cwd, "cards.txt") ),
    });
    for await (const line of rl) {
        if(line.length === 0) continue;
        await processCardLine(line);
        await sleep(100);
    }
    rl.close();
};
doit()
.then(() => {
    console.log("Done");
})

async function processCardLine(line: string) {    
    const regex = /[0-9]*[x]?[ ]?([\w+ !]+)\(?(\w{0,6})\)?/g;
    const matches = regex.exec(line);
    if(!matches) return;

    const cardName = matches[1].trim();
    const setCode = matches[2].trim();
    let query: string;
    if(setCode) {
        console.log(`Downloading card: ${cardName} (${setCode})`);
        query = `!"${cardName}" set:${setCode}`;
    }
    else {
        console.log(`Downloading card: ${cardName}`);
        query = `!"${cardName}"`;
    }

    const cards = await findAndSortCards(query);
    if(cards.length === 0) {
        console.error("No cards found for query: " + query)
        return;
    }

    const winner = cards[0];
    const downloadLocation = path.join(artFolderPath, `${winner.name}.jpg`);
    const downloadUri = winner.image_uris?.art_crop;
    if(downloadUri === undefined || downloadUri.length === 0) {
        console.error(`No cards with art_crop found for query '${query}'`);
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
         fs.writeFileSync(filename, data.read());                              
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