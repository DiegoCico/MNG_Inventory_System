# make sure you are in node 20

# install nvm (if you don’t have it)

brew install nvm
mkdir -p ~/.nvm
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
source ~/.zshrc

# install & use Node 20 (LTS)

nvm install 20
nvm use 20
nvm alias default 20

---

npm i -g aws-cdk

one-time cdk bootstrap aws://<ACCOUNT>/<REGION>

CDK
cd src/cdk
cdk bootstrap aws://YOUR_ACCOUNT/YOUR_REGION

STEPS:

# from root/

nvm use # uses Node 20 per .nvmrc
npm i # installs all workspace deps

# dev (frontend + api)

npm run dev # http://localhost:5173 (frontend), http://localhost:3001 (api)

# run everything (frontend + api + cdk TS watch)

npm run dev:all

# CDK (deploy infra when ready)

npm run build -w src/cdk
npm run synth -w src/cdk
npm run deploy -w src/cdk
