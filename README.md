# mtg-art-finder
Simple program to download mtg art, given a text file.

# Quick start
Download the latest release zip from the [Releases page](https://github.com/Gikkman/auto-modulate/releases/latest), extract it and run the executable to see the program in action. It'll download art for all cards in the `cards.txt` file.

You can edit settings in the `mtg-art-finder.properties` file (open it with Notepad). All paths should be relative to the runtime directory (i.e. this directory).

By default, the list of cards goes into the `cards.txt` file, and the downloaded images will be placed in a folder called `art`. 

The cards list allows you to specify set of a card, by putting the set code in paranthesis. for example `(SOM)` for Scars of Mirrodin. If no set is specified, the program will use the latest card art for that card it can find that is of reasonable quality.

# Development
## Install
To prepare this program, run:
```
npm install
```

## Run
To run the program, run:
```
npm run start
```

## Build release (Windows only)
To build a Windows executable, run:
```
npm run build
```