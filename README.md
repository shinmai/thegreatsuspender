# My personal fork of The Great Suspender with a few neat PRs from the original repo merged, will try to keep up to date with deanoemcke's official repo.

# <img src="/src/img/icon48.png" align="absmiddle"> The Great Suspender

### Welcome

"The Great Suspender" is a free and open-source Google Chrome extension for people who find that chrome is consuming too much system resource or suffer from frequent chrome crashing. Once installed and enabled, this extension will automatically *suspend* tabs that have not been used for a while, freeing up memory and cpu that the tab was consuming.

### Build from github

Dependencies: [openssl](https://slproweb.com/products/Win32OpenSSL.html), npm.

Clone the repository and run these commands:
```
npm config set production false
npm install
npm run generate-key
npm run build
```

It should say:
```
Done, without errors.
```

The extension in crx format will be inside the build/crx/ directory. You can drag it into [extensions] (chrome://extensions) to install locally.

### License

This work is licensed under a GNU GENERAL PUBLIC LICENSE (v2)

### Shoutouts

This package uses the [html2canvas](https://github.com/niklasvh/html2canvas) library written by Niklas von Hertzen.  
It also uses the indexedDb wrapper [db.js](https://github.com/aaronpowell/db.js) written by Aaron Powell.  
Thank you also to [BrowserStack](https://www.browserstack.com) for providing free chrome testing tools.
