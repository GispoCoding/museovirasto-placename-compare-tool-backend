# museovirasto-placename-compare-tool-backend

> Prototyping <a href="http://finto.fi/yso-paikat/fi/">YSO-paikat</a> enriching with the <a href="https://nimiarkisto.fi/">nimiarkisto.fi</a> data

Backend (REST API access) for a tool that helps to compare data from various place name &amp; ontology services

To try it, install and run it with the npm as explained below, do the same for the <a href="https://github.com/GispoCoding/museovirasto-placename-compare-tool-ui">frontend</a> and then head with the web browser to the <a href="http://localhost:8080">http://localhost:8080</a>.

## Install

In Ubuntu 16.04:
- sudo apt install build-essential
- sudo apt install python2.7 
- curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.
- export NVM_DIR="$HOME/.nvm"sh | bash
- [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
- nvm install 8
- npm install

## Run

npm run dev
